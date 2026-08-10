import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Products at or below their minimum threshold. Services never appear here — they don't track stock. */
  async lowStock(companyId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    if (!company.tracksInventory) return [];

    const products = await this.prisma.product.findMany({
      where: { companyId, type: ProductType.PRODUCT },
    });
    return products.filter((p) => p.quantity <= p.minQuantity);
  }

  /**
   * Manual stock correction (e.g. physical count, breakage, loss). Stock changes coming
   * from sales are handled transactionally inside SalesService, not here.
   * Runs inside a single transaction so the stock change and its audit trail never diverge.
   */
  async adjustStock(
    companyId: string,
    productId: string,
    userId: string,
    delta: number,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, companyId } });
      if (!product) throw new NotFoundException('Product not found');
      if (product.type === ProductType.SERVICE) {
        throw new BadRequestException('Services do not track stock');
      }

      const newQuantity = product.quantity + delta;
      if (newQuantity < 0) {
        throw new BadRequestException(
          `Adjustment would result in negative stock (current: ${product.quantity})`,
        );
      }

      const updated = await tx.product.update({
        where: { id: productId },
        data: { quantity: newQuantity },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'inventory.adjust',
          entityType: 'Product',
          entityId: productId,
          metadata: { delta, reason, previousQuantity: product.quantity, newQuantity },
        },
      });

      return updated;
    });
  }
}

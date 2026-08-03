import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/** Trim + uppercase; empty string normalizes to undefined (Prisma stores NULL). */
function normalizeSku(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim().toUpperCase();
  return trimmed || undefined;
}

// Product has exactly one unique constraint (@@unique([companyId, sku])), so any
// P2002 from a product write is unambiguously a duplicate SKU for this company.
function isSkuConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateProductDto) {
    const type = dto.type ?? ProductType.PRODUCT;
    // A service never participates in stock tracking, regardless of what was sent.
    const isService = type === ProductType.SERVICE;
    const sku = isService ? undefined : normalizeSku(dto.sku);
    if (!isService && !sku) {
      throw new BadRequestException('sku is required for stockable products');
    }

    try {
      return await this.prisma.product.create({
        data: {
          companyId,
          name: dto.name,
          sku,
          category: dto.category,
          type,
          salePrice: dto.salePrice,
          cost: dto.cost,
          quantity: isService ? 0 : (dto.quantity ?? 0),
          minQuantity: isService ? 0 : (dto.minQuantity ?? 0),
        },
      });
    } catch (err) {
      if (isSkuConflict(err)) {
        throw new ConflictException(`SKU "${sku}" already exists for this company`);
      }
      throw err;
    }
  }

  findAll(companyId: string, category?: string) {
    return this.prisma.product.findMany({
      where: { companyId, ...(category ? { category } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, companyId } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(companyId: string, id: string, dto: UpdateProductDto) {
    const current = await this.findOne(companyId, id);
    const type = dto.type ?? current.type;
    const isService = type === ProductType.SERVICE;
    // Resolved against the *current* row, not just this patch — a partial update
    // that never mentions sku/type must not be rejected just because the DTO alone
    // can't see what's already stored. Converting a product to a service clears
    // its sku, same as it already zeroes quantity/minQuantity below.
    const sku = isService ? undefined : dto.sku !== undefined ? normalizeSku(dto.sku) : (current.sku ?? undefined);
    if (!isService && !sku) {
      throw new BadRequestException('sku is required for stockable products');
    }

    try {
      return await this.prisma.product.update({
        where: { id },
        data: {
          ...dto,
          type,
          sku,
          quantity: isService ? 0 : (dto.quantity ?? current.quantity),
          minQuantity: isService ? 0 : (dto.minQuantity ?? current.minQuantity),
        },
      });
    } catch (err) {
      if (isSkuConflict(err)) {
        throw new ConflictException(`SKU "${sku}" already exists for this company`);
      }
      throw err;
    }
  }
}

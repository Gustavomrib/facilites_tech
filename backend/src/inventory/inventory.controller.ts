import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/auth-request';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('low-stock')
  lowStock(@CurrentUser() user: JwtPayload) {
    return this.inventoryService.lowStock(user.companyId);
  }

  @Post(':productId/adjust')
  adjust(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventoryService.adjustStock(
      user.companyId,
      productId,
      user.sub,
      dto.delta,
      dto.reason,
    );
  }
}

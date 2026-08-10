import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/auth-request';
import { CreateFixedExpenseDto } from './dto/create-fixed-expense.dto';
import { FixedExpensesService } from './fixed-expenses.service';

@ApiTags('fixed-expenses')
@ApiBearerAuth()
@Controller('fixed-expenses')
export class FixedExpensesController {
  constructor(private readonly fixedExpensesService: FixedExpensesService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateFixedExpenseDto) {
    return this.fixedExpensesService.create(user.companyId, user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.fixedExpensesService.findAll(user.companyId);
  }

  @Delete(':id')
  deactivate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.fixedExpensesService.deactivate(user.companyId, id, user.sub);
  }
}

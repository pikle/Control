import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('bootstrap')
  bootstrap(@Body() body: { accountId?: string; accountName?: string }) {
    return this.adminService.bootstrap(body.accountId, body.accountName);
  }

  @Get('bots')
  getBots() {
    return this.adminService.getBots();
  }

  @Post('bots')
  createBot(
    @Body()
    body: { accountId: string; name: string; token: string; webhookSecret?: string },
  ) {
    return this.adminService.createBot(body);
  }

  @Post('bots/:botId/connect-webhook')
  connectWebhook(@Param('botId') botId: string) {
    return this.adminService.connectBotWebhook(botId);
  }

  @Get('custom-fields/:accountId')
  getCustomFields(@Param('accountId') accountId: string) {
    return this.adminService.getCustomFields(accountId);
  }

  @Post('custom-fields')
  createCustomField(
    @Body()
    body: {
      accountId: string;
      key: string;
      label: string;
      type: 'TEXT' | 'NUMBER' | 'SELECT';
      options?: string[];
      sortOrder?: number;
      isRequired?: boolean;
    },
  ) {
    return this.adminService.createCustomField(body);
  }

  @Put('custom-fields/:fieldId')
  updateCustomField(
    @Param('fieldId') fieldId: string,
    @Body()
    body: {
      label?: string;
      type?: 'TEXT' | 'NUMBER' | 'SELECT';
      options?: string[];
      sortOrder?: number;
      isRequired?: boolean;
    },
  ) {
    return this.adminService.updateCustomField(fieldId, body);
  }

  @Post('custom-fields/:fieldId/delete')
  deleteCustomField(@Param('fieldId') fieldId: string) {
    return this.adminService.deleteCustomField(fieldId);
  }

  @Put('custom-field-values')
  setCustomFieldValue(
    @Body()
    body: {
      accountId: string;
      customFieldId: string;
      chatId: string;
      valueText?: string;
      valueNumber?: number;
    },
  ) {
    return this.adminService.setCustomFieldValue(body);
  }

  @Get('users/:accountId')
  getUsers(@Param('accountId') accountId: string) {
    return this.adminService.getUsers(accountId);
  }

  @Put('users/:userId/role')
  setUserRole(@Param('userId') userId: string, @Body() body: { role: UserRole }) {
    return this.adminService.setUserRole(userId, body.role);
  }

  @Get('logs/:accountId')
  getLogs(@Param('accountId') accountId: string) {
    return this.adminService.getLogs(accountId);
  }
}

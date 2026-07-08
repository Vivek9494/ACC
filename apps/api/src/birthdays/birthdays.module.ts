import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { BirthdaysController } from './birthdays.controller';

@Module({
  imports: [AuthModule, AdminModule],
  controllers: [BirthdaysController],
})
export class BirthdaysModule {}

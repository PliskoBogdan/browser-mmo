import 'dotenv/config';
import { Injectable } from '@nestjs/common';
// import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client/client';

const connectionString = `${process.env.DATABASE_URL}`;

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const adapter = new PrismaPg({ connectionString });

    super({ adapter });
  }
}

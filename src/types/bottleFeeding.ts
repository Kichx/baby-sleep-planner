import type { ISODateString } from '@/types/sleep';

export interface BottleFeeding {
  id: string;
  childId: string;
  startedAt: ISODateString;
  volumeMl: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface BottleFeedingStats {
  count: number;
  totalVolumeMl: number;
}

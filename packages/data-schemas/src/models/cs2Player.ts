import cs2PlayerSchema from '~/schema/cs2Player';
import type { ICS2Player } from '~/types';

/**
 * Creates or returns the CS2Player model using the provided mongoose instance and schema
 */
export function createCS2PlayerModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.CS2Player || mongoose.model<ICS2Player>('CS2Player', cs2PlayerSchema);
}

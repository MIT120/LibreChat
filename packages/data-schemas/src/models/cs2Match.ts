import cs2MatchSchema from '~/schema/cs2Match';
import type { ICS2Match } from '~/types';

/**
 * Creates or returns the CS2Match model using the provided mongoose instance and schema
 */
export function createCS2MatchModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.CS2Match || mongoose.model<ICS2Match>('CS2Match', cs2MatchSchema);
}

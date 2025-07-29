import cs2TeamSchema from '~/schema/cs2Team';
import type { ICS2Team } from '~/types';

/**
 * Creates or returns the CS2Team model using the provided mongoose instance and schema
 */
export function createCS2TeamModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.CS2Team || mongoose.model<ICS2Team>('CS2Team', cs2TeamSchema);
}

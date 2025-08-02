import { PageSchema } from '~/schema/book';
import type * as t from '~/types';

/**
 * Creates or returns the Page model using the provided mongoose instance and schema
 */
export function createPageModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.Page || mongoose.model<t.IPage>('Page', PageSchema);
}

import { ChapterSchema } from '~/schema/book';
import type * as t from '~/types';

/**
 * Creates or returns the Chapter model using the provided mongoose instance and schema
 */
export function createChapterModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.Chapter || mongoose.model<t.IChapter>('Chapter', ChapterSchema);
}

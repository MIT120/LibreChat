import type * as t from '~/types';
import chapterSchema from '~/schema/chapter';

/**
 * Creates or returns the Chapter model using the provided mongoose instance and schema
 */
export function createChapterModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.Chapter || mongoose.model<t.IChapter>('Chapter', chapterSchema);
}
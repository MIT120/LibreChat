import type * as t from '~/types';
import bookSchema from '~/schema/book';

/**
 * Creates or returns the Book model using the provided mongoose instance and schema
 */
export function createBookModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.Book || mongoose.model<t.IBook>('Book', bookSchema);
}
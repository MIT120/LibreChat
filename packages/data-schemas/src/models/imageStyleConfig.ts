import { ImageStyleConfigSchema } from '~/schema/imageStyleConfig';
import type * as t from '~/types';

/**
 * Creates or returns the ImageStyleConfig model using the provided mongoose instance and schema
 */
export function createImageStyleConfigModel(mongoose: typeof import('mongoose')) {
    return (
        mongoose.models.ImageStyleConfig ||
        mongoose.model<t.IImageStyleConfig>('ImageStyleConfig', ImageStyleConfigSchema)
    );
}

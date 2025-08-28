import { Schema } from 'mongoose';
import { IImageStyleConfig, IImageStyle } from '~/types/imageStyleConfig';

// Image Style sub-schema
const ImageStyleSchema = new Schema<IImageStyle>(
    {
        description: {
            type: String,
            required: true,
            trim: true,
        },
        dallePrompt: {
            type: String,
            required: true,
            trim: true,
        },
        appropriateGenres: {
            type: [String],
            default: [],
        },
        appropriateAudiences: {
            type: [String],
            default: [],
        },
        ageRating: {
            type: String,
            enum: ['all-ages', 'teen', 'adult', 'mature'],
            required: true,
            default: 'all-ages',
        },
        visualCharacteristics: {
            type: [String],
            default: [],
        },
    },
    { _id: false }, // Don't create _id for sub-documents
);

// Main ImageStyleConfig schema
const ImageStyleConfigSchema = new Schema<IImageStyleConfig>(
    {
        configId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
        styles: {
            type: Map,
            of: ImageStyleSchema,
            required: true,
        },
        genreMapping: {
            type: Map,
            of: [String],
            required: true,
        },
        audienceMapping: {
            type: Map,
            of: [String],
            required: true,
        },
        toneMapping: {
            type: Map,
            of: [String],
            required: true,
        },
        createdBy: {
            type: String,
            trim: true,
        },
        updatedBy: {
            type: String,
            trim: true,
        },
        version: {
            type: Number,
            default: 1,
            min: 1,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    },
);

// Indexes
ImageStyleConfigSchema.index({ configId: 1 }, { unique: true });
ImageStyleConfigSchema.index({ isActive: 1 });
ImageStyleConfigSchema.index({ isDefault: 1 });
ImageStyleConfigSchema.index({ name: 1 });
ImageStyleConfigSchema.index({ createdAt: -1 });

// Ensure only one default configuration
ImageStyleConfigSchema.pre('save', async function (next) {
    if (this.isDefault && this.isModified('isDefault')) {
        // If this is being set as default, unset all other defaults
        await this.constructor.updateMany(
            { _id: { $ne: this._id }, isDefault: true },
            { $set: { isDefault: false } },
        );
    }
    next();
});

// Virtual for total styles count
ImageStyleConfigSchema.virtual('stylesCount').get(function () {
    return this.styles ? this.styles.size : 0;
});

export { ImageStyleConfigSchema };

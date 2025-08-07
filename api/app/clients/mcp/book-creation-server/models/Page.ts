import mongoose, { Schema, Document } from 'mongoose';
import { IPage, PageStatus } from '../types/book.js';

// Image placement interface
export interface IImagePlacement {
  position: 'before' | 'after' | 'between';
  reason?: string;
  confidence: number;
}

// Context analysis interface
export interface IContextAnalysis {
  themes: string[];
  characters: string[];
  setting?: string;
  mood?: string;
  actionLevel?: string;
  storyBeat?: string;
}

// Page image interface
export interface IPageImage {
  id: string;
  url: string;
  localPath: string;
  placement: IImagePlacement;
  prompt?: string;
  style?: string;
  contextAnalysis?: IContextAnalysis;
  generatedAt: Date;
  status: 'generating' | 'generated' | 'failed' | 'approved';
}

// Extended page interface with images
export interface IPageWithImages extends IPage {
  images: IPageImage[];
}

// Document interface for Mongoose
export interface IPageDocument extends IPageWithImages, Document {}

// Image placement sub-schema
const ImagePlacementSchema = new Schema<IImagePlacement>({
  position: {
    type: String,
    enum: ['before', 'after', 'between'],
    default: 'between',
  },
  reason: String,
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8,
  },
}, { _id: false });

// Context analysis sub-schema
const ContextAnalysisSchema = new Schema<IContextAnalysis>({
  themes: [String],
  characters: [String],
  setting: String,
  mood: String,
  actionLevel: String,
  storyBeat: String,
}, { _id: false });

// Page image sub-schema
const PageImageSchema = new Schema<IPageImage>({
  id: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  localPath: {
    type: String,
    required: true,
  },
  placement: {
    type: ImagePlacementSchema,
    required: true,
  },
  prompt: String,
  style: String,
  contextAnalysis: ContextAnalysisSchema,
  generatedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['generating', 'generated', 'failed', 'approved'],
    default: 'generated',
  },
}, { _id: false });

// Page schema
const PageSchema = new Schema<IPageDocument>({
  _id: {
    type: String,
    required: true,
  },
  pageId: {
    type: String,
    required: true,
    unique: true,
  },
  chapterId: {
    type: String,
    required: true,
    ref: 'Chapter',
  },
  pageNumber: {
    type: Number,
    required: true,
    min: 1,
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  wordCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  notes: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: Object.values(PageStatus),
    default: PageStatus.DRAFT,
  },
  images: [PageImageSchema],
}, { 
  timestamps: true,
  collection: 'pages'
});

// Indexes for better performance
PageSchema.index({ chapterId: 1, pageNumber: 1 });
PageSchema.index({ status: 1 });

// Export the model
export const Page = mongoose.model<IPageDocument>('Page', PageSchema);
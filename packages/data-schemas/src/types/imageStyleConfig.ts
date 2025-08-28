/**
 * Image Style Configuration Types
 */

export interface IImageStyle {
    description: string;
    dallePrompt: string;
    appropriateGenres: string[];
    appropriateAudiences: string[];
    ageRating: 'all-ages' | 'teen' | 'adult' | 'mature';
    visualCharacteristics: string[];
}

export interface IImageStyleConfig {
    _id?: string;
    configId: string;
    name: string;
    description?: string;
    isActive: boolean;
    isDefault: boolean;
    styles: Record<string, IImageStyle>;
    genreMapping: Record<string, string[]>;
    audienceMapping: Record<string, string[]>;
    toneMapping: Record<string, string[]>;
    createdBy?: string;
    updatedBy?: string;
    version: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ICreateImageStyleConfigRequest {
    configId?: string;
    name: string;
    description?: string;
    isActive?: boolean;
    isDefault?: boolean;
    styles: Record<string, IImageStyle>;
    genreMapping: Record<string, string[]>;
    audienceMapping: Record<string, string[]>;
    toneMapping: Record<string, string[]>;
    createdBy?: string;
}

export interface IUpdateImageStyleConfigRequest {
    name?: string;
    description?: string;
    isActive?: boolean;
    isDefault?: boolean;
    styles?: Record<string, IImageStyle>;
    genreMapping?: Record<string, string[]>;
    audienceMapping?: Record<string, string[]>;
    toneMapping?: Record<string, string[]>;
    updatedBy?: string;
}

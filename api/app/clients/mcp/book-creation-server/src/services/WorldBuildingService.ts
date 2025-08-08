/**
 * World Building Service - Character and world management for fiction writing
 */

import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';

export interface Character {
    id: string;
    name: string;
    description: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    traits: string[];
    relationships: Array<{ characterId: string; relationship: string }>;
    backstory: string;
    goals: string[];
    conflicts: string[];
    arc: string;
    createdAt: Date;
}

export interface Location {
    id: string;
    name: string;
    description: string;
    type: 'setting' | 'landmark' | 'building' | 'region';
    geography: string;
    atmosphere: string;
    significance: string;
    connectedLocations: string[];
    characters: string[];
    events: string[];
    createdAt: Date;
}

export interface WorldElement {
    id: string;
    name: string;
    type: 'culture' | 'religion' | 'technology' | 'magic' | 'politics' | 'economy' | 'language';
    description: string;
    rules: string[];
    history: string;
    impact: string;
    relatedElements: string[];
    createdAt: Date;
}

export class WorldBuildingService extends BaseService {
    private characters = new Map<string, Character>();
    private locations = new Map<string, Location>();
    private worldElements = new Map<string, WorldElement>();

    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('WorldBuildingService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('WorldBuildingService disposed');
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        return {
            status: ServiceHealthStatus.HEALTHY,
            message: 'World building service operational',
            details: {
                charactersCount: this.characters.size,
                locationsCount: this.locations.size,
                worldElementsCount: this.worldElements.size,
            },
            lastCheck: new Date(),
        };
    }

    async createCharacter(bookId: string, character: Omit<Character, 'id' | 'createdAt'>): Promise<Character> {
        return this.executeWithLogging('createCharacter', async () => {
            const newCharacter: Character = {
                ...character,
                id: `char-${Date.now()}-${Math.random()}`,
                createdAt: new Date(),
            };

            this.characters.set(newCharacter.id, newCharacter);

            this.logger.info('Character created', {
                characterId: newCharacter.id,
                name: character.name,
                role: character.role,
            });

            return newCharacter;
        }, { bookId, characterName: character.name });
    }

    async createLocation(bookId: string, location: Omit<Location, 'id' | 'createdAt'>): Promise<Location> {
        return this.executeWithLogging('createLocation', async () => {
            const newLocation: Location = {
                ...location,
                id: `loc-${Date.now()}-${Math.random()}`,
                createdAt: new Date(),
            };

            this.locations.set(newLocation.id, newLocation);

            this.logger.info('Location created', {
                locationId: newLocation.id,
                name: location.name,
                type: location.type,
            });

            return newLocation;
        }, { bookId, locationName: location.name });
    }

    async createWorldElement(bookId: string, element: Omit<WorldElement, 'id' | 'createdAt'>): Promise<WorldElement> {
        return this.executeWithLogging('createWorldElement', async () => {
            const newElement: WorldElement = {
                ...element,
                id: `elem-${Date.now()}-${Math.random()}`,
                createdAt: new Date(),
            };

            this.worldElements.set(newElement.id, newElement);

            this.logger.info('World element created', {
                elementId: newElement.id,
                name: element.name,
                type: element.type,
            });

            return newElement;
        }, { bookId, elementName: element.name });
    }

    async getWorldOverview(bookId: string): Promise<any> {
        return this.executeWithLogging('getWorldOverview', async () => {
            const allCharacters = Array.from(this.characters.values());
            const allLocations = Array.from(this.locations.values());
            const allElements = Array.from(this.worldElements.values());

            return {
                characters: {
                    total: allCharacters.length,
                    byRole: allCharacters.reduce((acc: any, char) => {
                        acc[char.role] = (acc[char.role] || 0) + 1;
                        return acc;
                    }, {}),
                    list: allCharacters,
                },
                locations: {
                    total: allLocations.length,
                    byType: allLocations.reduce((acc: any, loc) => {
                        acc[loc.type] = (acc[loc.type] || 0) + 1;
                        return acc;
                    }, {}),
                    list: allLocations,
                },
                worldElements: {
                    total: allElements.length,
                    byType: allElements.reduce((acc: any, elem) => {
                        acc[elem.type] = (acc[elem.type] || 0) + 1;
                        return acc;
                    }, {}),
                    list: allElements,
                },
            };
        }, { bookId });
    }
}

export default WorldBuildingService;

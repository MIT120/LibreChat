import { Schema } from 'mongoose';
import type { ICS2Match } from '~/types';

const cs2MatchSchema = new Schema<ICS2Match>(
  {
    hltvId: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: function (v: string) {
          return /^\d+$/.test(v);
        },
        message: 'HLTV ID must be a numeric string',
      },
    },
    date: {
      type: Date,
      required: true,
    },
    tournament: {
      name: {
        type: String,
        required: true,
      },
      tier: {
        type: String,
        enum: ['S', 'A', 'B', 'C', 'D'],
      },
      prizePool: {
        type: Number,
      },
      location: {
        type: String,
      },
    },
    teams: [
      {
        team: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Team',
          required: true,
        },
        score: {
          type: Number,
          default: 0,
        },
        side: {
          type: String,
          enum: ['CT', 'T'],
        },
        isWinner: {
          type: Boolean,
          default: false,
        },
      },
    ],
    maps: [
      {
        name: {
          type: String,
          required: true,
        },
        pickBy: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Team',
        },
        winner: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Team',
        },
        score: {
          team1: {
            type: Number,
            default: 0,
            min: 0,
            max: 30,
          },
          team2: {
            type: Number,
            default: 0,
            min: 0,
            max: 30,
          },
        },
        rounds: [
          {
            number: {
              type: Number,
              required: true,
            },
            winner: {
              type: String,
              enum: ['CT', 'T'],
            },
            reason: {
              type: String,
              enum: ['elimination', 'time', 'bomb_defused', 'bomb_exploded'],
            },
            ctScore: {
              type: Number,
              default: 0,
            },
            tScore: {
              type: Number,
              default: 0,
            },
            players: [
              {
                player: {
                  type: Schema.Types.ObjectId,
                  ref: 'CS2Player',
                },
                kills: {
                  type: Number,
                  default: 0,
                },
                deaths: {
                  type: Number,
                  default: 0,
                },
                assists: {
                  type: Number,
                  default: 0,
                },
                damage: {
                  type: Number,
                  default: 0,
                },
                side: {
                  type: String,
                  enum: ['CT', 'T'],
                },
              },
            ],
          },
        ],
        playerStats: [
          {
            player: {
              type: Schema.Types.ObjectId,
              ref: 'CS2Player',
            },
            kills: {
              type: Number,
              default: 0,
            },
            deaths: {
              type: Number,
              default: 0,
            },
            assists: {
              type: Number,
              default: 0,
            },
            adr: {
              type: Number,
              default: 0,
            },
            rating: {
              type: Number,
              default: 0,
            },
            kast: {
              type: Number,
              default: 0,
            },
          },
        ],
      },
    ],
    status: {
      type: String,
      enum: ['upcoming', 'live', 'finished'],
      default: 'upcoming',
    },
    format: {
      type: String,
      enum: ['bo1', 'bo3', 'bo5'],
      default: 'bo1',
    },
    liveData: {
      currentMap: {
        type: Number,
        default: 0,
      },
      currentRound: {
        type: Number,
        default: 0,
      },
      score: {
        team1: {
          type: Number,
          default: 0,
        },
        team2: {
          type: Number,
          default: 0,
        },
      },
      economy: {
        team1: {
          type: Number,
          default: 0,
        },
        team2: {
          type: Number,
          default: 0,
        },
      },
    },
    predictions: {
      halfTime: {
        predicted: {
          type: Boolean,
          default: false,
        },
        winner: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Team',
        },
        confidence: {
          type: Number,
          min: 0,
          max: 1,
        },
        actualWinner: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Team',
        },
        factors: [
          {
            name: {
              type: String,
            },
            weight: {
              type: Number,
            },
            value: {
              type: Schema.Types.Mixed,
            },
          },
        ],
      },
      mapWinner: {
        predicted: {
          type: Boolean,
          default: false,
        },
        winner: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Team',
        },
        confidence: {
          type: Number,
          min: 0,
          max: 1,
        },
        actualWinner: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Team',
        },
        factors: [
          {
            name: {
              type: String,
            },
            weight: {
              type: Number,
            },
            value: {
              type: Schema.Types.Mixed,
            },
          },
        ],
      },
      seriesOutcome: {
        predicted: {
          type: Boolean,
          default: false,
        },
        outcome: {
          type: String,
          enum: ['2-0', '2-1', '3-0', '3-1', '3-2'],
        },
        winner: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Team',
        },
        confidence: {
          type: Number,
          min: 0,
          max: 1,
        },
        actualOutcome: {
          type: String,
          enum: ['2-0', '2-1', '3-0', '3-1', '3-2'],
        },
        actualWinner: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Team',
        },
        factors: [
          {
            name: {
              type: String,
            },
            weight: {
              type: Number,
            },
            value: {
              type: Schema.Types.Mixed,
            },
          },
        ],
      },
    },
    embeddings: {
      teamPerformance: {
        type: [Number],
        default: undefined,
      },
      mapStats: {
        type: [Number],
        default: undefined,
      },
      playerMetrics: {
        type: [Number],
        default: undefined,
      },
      contextual: {
        type: [Number],
        default: undefined,
      },
    },
    metadata: {
      scrapedAt: {
        type: Date,
        default: Date.now,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
      source: {
        type: String,
        default: 'HLTV',
      },
      version: {
        type: String,
        default: '1.0',
      },
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
cs2MatchSchema.index({ date: -1, status: 1 });
cs2MatchSchema.index({ 'teams.team': 1, date: -1 });
cs2MatchSchema.index({ 'tournament.name': 1, date: -1 });
cs2MatchSchema.index({ status: 1, date: 1 });
cs2MatchSchema.index({ hltvId: 1 }, { unique: true });

export default cs2MatchSchema;

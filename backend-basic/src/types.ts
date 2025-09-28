import {z} from 'zod';

export const OrderInputSchema = z.object({
    baseAsset: z.string(),
    quoteAsset: z.string(),
    price: z.number().positive(),
    quantity: z.number().positive(),
    side: z.enum(['buy', 'sell']),
    type: z.enum(['limit', 'market']),
    kind: z.enum(['ioc']).optional(),
});
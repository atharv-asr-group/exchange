import express from 'express';
import { OrderInputSchema } from './types';
import { orderBook, bookWithQuantity } from './orderBook';

const BASE_ASSET = 'BTC';
const QUOTE_ASSET = 'USD';

const app = express();
app.use(express.json());

let GLOBAL_TRADE_ID = 0;

app.post('/api/v1/order', (req, res) => {
    console.log('Received order:', req.body);
    const order = OrderInputSchema.safeParse(req.body);
    if(!order.success){
        console.log(order);
        return res.status(400).send(order.error.message);
    }
    const {baseAsset, quoteAsset, price, quantity, side, kind} = order.data;
    const orderId=getOrderId();
    if(baseAsset !== BASE_ASSET || quoteAsset !== QUOTE_ASSET){
        return res.status(400).send('Invalid base or quote asset');
    }

    const {executedQty, fills}=fillOrder(orderId,price, quantity, side, kind);
    console.log('orderbook after order:', orderBook);
    console.log('book with quantity after order:', bookWithQuantity);
    return res.status(200).send({
        orderId,
        executedQty,
        fills});
    });



app.listen(3000, () => {
    console.log('Server started on port 3000');
});

function getOrderId():string{
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}


interface Fill{
    "price": number;
    "quantity": number;
    "tradeId": number;
}

function fillOrder(orderId: string, price: number, quantity: number, side: "buy" | "sell", type?: "ioc"): { status: "rejected" | "accepted"; executedQty: number; fills: Fill[] } {
    const fills: Fill[] = [];
    const maxFillQuantity = getFillAmount(price, quantity, side); // 20
    let executedQty = 0;

    if (type === 'ioc' && maxFillQuantity < quantity) {
        return { status: 'rejected', executedQty: maxFillQuantity, fills: [] };
    }
    
    if (side === 'buy') {
        // asks should be sorted before you try to fill them
        orderBook.asks.forEach(o => {
            if (o.price <= price && quantity > 0) {
                const filledQuantity = Math.min(quantity, o.quantity);
                o.quantity -= filledQuantity;
                bookWithQuantity.asks[o.price] = (bookWithQuantity.asks[o.price] || 0) - filledQuantity;
                fills.push({
                    price: o.price,
                    quantity: filledQuantity,
                    tradeId: GLOBAL_TRADE_ID++
                });
                executedQty += filledQuantity;
                quantity -= filledQuantity;
                if (o.quantity === 0) {
                    orderBook.asks.splice(orderBook.asks.indexOf(o), 1);
                }
                if (bookWithQuantity.asks[price] === 0) {
                    delete bookWithQuantity.asks[price];
                }
            }
        });

        // Place on the book if order not filled
        if (quantity !== 0) {
            orderBook.bids.push({
                price,
                quantity: quantity - executedQty,
                side: 'bid',
                orderId
            });
            bookWithQuantity.bids[price] = (bookWithQuantity.bids[price] || 0) + (quantity - executedQty);
        }
    } else {
        orderBook.bids.forEach(o => {
            if (o.price >= price && quantity > 0) {
                const filledQuantity = Math.min(quantity, o.quantity);
                o.quantity -= filledQuantity;
                bookWithQuantity.bids[price] = (bookWithQuantity.bids[price] || 0) - filledQuantity;
                fills.push({
                    price: o.price,
                    quantity: filledQuantity,
                    tradeId: GLOBAL_TRADE_ID++
                });
                executedQty += filledQuantity;
                quantity -= filledQuantity;
                if (o.quantity === 0) {
                    orderBook.bids.splice(orderBook.bids.indexOf(o), 1);
                }
                if (bookWithQuantity.bids[price] === 0) {
                    delete bookWithQuantity.bids[price];
                }
            }
        });

        // Place on the book if order not filled
        if (quantity !== 0) {
            orderBook.asks.push({
                price,
                quantity: quantity,
                side: 'sell',
                orderId
            });
            bookWithQuantity.asks[price] = (bookWithQuantity.asks[price] || 0) + (quantity);
        }
    }
    console.log('orderbook inside fillOrder:', orderBook);
    console.log('book with quantity inside fillOrder:', bookWithQuantity);

    return {
        status: 'accepted',
        executedQty,
        fills
    }
}

function getFillAmount(price: number, quantity: number, side: "buy" | "sell"): number {
    let filled = 0;
    if (side === 'buy') {
        orderBook.asks.forEach(o => {
            if (o.price < price) {
                filled += Math.min(quantity, o.quantity);
            }
        });
    } else {
        orderBook.bids.forEach(o => {
            if (o.price > price) {
                filled += Math.min(quantity, o.quantity);
            }
        });
    }
    return filled;
}

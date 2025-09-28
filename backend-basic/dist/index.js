"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const types_1 = require("./types");
const orderBook_1 = require("./orderBook");
const BASE_ASSET = 'BTC';
const QUOTE_ASSET = 'USD';
const app = (0, express_1.default)();
app.use(express_1.default.json());
let GLOBAL_TRADE_ID = 0;
app.post('/api/v1/order', (req, res) => {
    console.log('Received order:', req.body);
    const order = types_1.OrderInputSchema.safeParse(req.body);
    if (!order.success) {
        console.log(order);
        return res.status(400).send(order.error.message);
    }
    const { baseAsset, quoteAsset, price, quantity, side, kind } = order.data;
    const orderId = getOrderId();
    if (baseAsset !== BASE_ASSET || quoteAsset !== QUOTE_ASSET) {
        return res.status(400).send('Invalid base or quote asset');
    }
    const { executedQty, fills } = fillOrder(orderId, price, quantity, side, kind);
    console.log('orderbook after order:', orderBook_1.orderBook);
    console.log('book with quantity after order:', orderBook_1.bookWithQuantity);
    return res.status(200).send({
        orderId,
        executedQty,
        fills
    });
});
app.listen(3000, () => {
    console.log('Server started on port 3000');
});
function getOrderId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
function fillOrder(orderId, price, quantity, side, type) {
    const fills = [];
    const maxFillQuantity = getFillAmount(price, quantity, side); // 20
    let executedQty = 0;
    if (type === 'ioc' && maxFillQuantity < quantity) {
        return { status: 'rejected', executedQty: maxFillQuantity, fills: [] };
    }
    if (side === 'buy') {
        // asks should be sorted before you try to fill them
        orderBook_1.orderBook.asks.forEach(o => {
            if (o.price <= price && quantity > 0) {
                const filledQuantity = Math.min(quantity, o.quantity);
                o.quantity -= filledQuantity;
                orderBook_1.bookWithQuantity.asks[o.price] = (orderBook_1.bookWithQuantity.asks[o.price] || 0) - filledQuantity;
                fills.push({
                    price: o.price,
                    quantity: filledQuantity,
                    tradeId: GLOBAL_TRADE_ID++
                });
                executedQty += filledQuantity;
                quantity -= filledQuantity;
                if (o.quantity === 0) {
                    orderBook_1.orderBook.asks.splice(orderBook_1.orderBook.asks.indexOf(o), 1);
                }
                if (orderBook_1.bookWithQuantity.asks[price] === 0) {
                    delete orderBook_1.bookWithQuantity.asks[price];
                }
            }
        });
        // Place on the book if order not filled
        if (quantity !== 0) {
            orderBook_1.orderBook.bids.push({
                price,
                quantity: quantity - executedQty,
                side: 'bid',
                orderId
            });
            orderBook_1.bookWithQuantity.bids[price] = (orderBook_1.bookWithQuantity.bids[price] || 0) + (quantity - executedQty);
        }
    }
    else {
        orderBook_1.orderBook.bids.forEach(o => {
            if (o.price >= price && quantity > 0) {
                const filledQuantity = Math.min(quantity, o.quantity);
                o.quantity -= filledQuantity;
                orderBook_1.bookWithQuantity.bids[price] = (orderBook_1.bookWithQuantity.bids[price] || 0) - filledQuantity;
                fills.push({
                    price: o.price,
                    quantity: filledQuantity,
                    tradeId: GLOBAL_TRADE_ID++
                });
                executedQty += filledQuantity;
                quantity -= filledQuantity;
                if (o.quantity === 0) {
                    orderBook_1.orderBook.bids.splice(orderBook_1.orderBook.bids.indexOf(o), 1);
                }
                if (orderBook_1.bookWithQuantity.bids[price] === 0) {
                    delete orderBook_1.bookWithQuantity.bids[price];
                }
            }
        });
        // Place on the book if order not filled
        if (quantity !== 0) {
            orderBook_1.orderBook.asks.push({
                price,
                quantity: quantity,
                side: 'sell',
                orderId
            });
            orderBook_1.bookWithQuantity.asks[price] = (orderBook_1.bookWithQuantity.asks[price] || 0) + (quantity);
        }
    }
    console.log('orderbook inside fillOrder:', orderBook_1.orderBook);
    console.log('book with quantity inside fillOrder:', orderBook_1.bookWithQuantity);
    return {
        status: 'accepted',
        executedQty,
        fills
    };
}
function getFillAmount(price, quantity, side) {
    let filled = 0;
    if (side === 'buy') {
        orderBook_1.orderBook.asks.forEach(o => {
            if (o.price < price) {
                filled += Math.min(quantity, o.quantity);
            }
        });
    }
    else {
        orderBook_1.orderBook.bids.forEach(o => {
            if (o.price > price) {
                filled += Math.min(quantity, o.quantity);
            }
        });
    }
    return filled;
}

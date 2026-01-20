const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- 1. MONGODB BAĞLANTISI ---
// BURADAKİ LİNKTE SIFREN KISMINI KENDİ ŞİFRENLE DEĞİŞTİRMEYİ UNUTMA!
const mongoURI = "mongodb+srv://berkayfm72:TSWveDdH6EN8dwQb@cluster0.m1xbymq.mongodb.net/?appName=Cluster0";

mongoose.connect(mongoURI)
    .then(() => console.log("🚀 MongoDB Atlas Bağlantısı Başarılı!"))
    .catch(err => console.log("❌ MongoDB Bağlantı Hatası:", err));

// --- 2. VERİ MODELLERİ ---
const Product = mongoose.model('Product', {
    name: String,
    price: Number,
    category: String,
    id: Number
});

const Campaign = mongoose.model('Campaign', {
    name: String,
    type: String,
    targetProductId: Number,
    buyCount: Number,
    payCount: Number,
    category1: String,
    category2: String,
    discountAmount: Number,
    percent: Number,
    id: Number
});

// --- 3. API ENDPOINTLERİ ---

app.get('/api/products', async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

app.post('/api/products', async (req, res) => {
    const newProduct = new Product({ ...req.body, id: Date.now() });
    await newProduct.save();
    res.json({ message: "Ürün Kaydedildi", product: newProduct });
});

app.get('/api/campaigns', async (req, res) => {
    const campaigns = await Campaign.find();
    res.json(campaigns);
});

app.post('/api/campaigns', async (req, res) => {
    const newCampaign = new Campaign({ ...req.body, id: Date.now() });
    await newCampaign.save();
    res.json({ message: "Kampanya Kaydedildi", campaign: newCampaign });
});

// --- 4. HESAPLAMA MOTORU (DÜZELTİLMİŞ VE TAMAMLANMIŞ) ---
app.post('/api/calculate', async (req, res) => {
    console.log("\n--------------------------------------------------");
    console.log("🧮 HESAPLAMA İSTEĞİ GELDİ (DB UYUMLU)...");

    const cartItems = req.body.items;
    const productsDB = await Product.find();
    const campaignsDB = await Campaign.find();

    let rawTotal = 0;
    
    // Sepeti Veritabanı Bilgileriyle Zenginleştir
    const enrichedCart = cartItems.map(cartItem => {
        const productInfo = productsDB.find(p => p.id == cartItem.productId);
        if(!productInfo) return null;
        
        rawTotal += productInfo.price * cartItem.qty;
        return { 
            ...cartItem, 
            id: productInfo.id,
            price: productInfo.price, 
            category: productInfo.category, 
            name: productInfo.name 
        };
    }).filter(i => i !== null);

    console.log(`💰 Sepet Toplamı: ${rawTotal} TL`);

    let bestOffer = { name: "Kampanya Yok", discount: 0, total: rawTotal };

    // Kampanyaları Tek Tek Veritabanından Gelen Verilere Göre Dene
    campaignsDB.forEach(camp => {
        let currentDiscount = 0;

        if (camp.type === "X_AL_Y_ODE") {
            const targetItem = enrichedCart.find(i => i.id == camp.targetProductId);
            if (targetItem && targetItem.qty >= camp.buyCount) {
                const sets = Math.floor(targetItem.qty / camp.buyCount);
                currentDiscount = ((camp.buyCount - camp.payCount) * sets) * targetItem.price;
            }
        }
        else if (camp.type === "BUNDLE") {
            const count1 = enrichedCart.filter(i => i.category === camp.category1).reduce((acc, i) => acc + i.qty, 0);
            const count2 = enrichedCart.filter(i => i.category === camp.category2).reduce((acc, i) => acc + i.qty, 0);
            const sets = Math.min(count1, count2);
            if (sets > 0) currentDiscount = sets * camp.discountAmount;
        }
        else if (camp.type === "PERCENTAGE") {
            const targetItem = enrichedCart.find(i => i.id == camp.targetProductId);
            if (targetItem) {
                currentDiscount += (targetItem.price * targetItem.qty) * (camp.percent / 100);
            }
        }

        if (currentDiscount > bestOffer.discount) {
            bestOffer = { name: camp.name, discount: currentDiscount, total: rawTotal - currentDiscount };
        }
    });

    console.log(`🏆 Kazanan: ${bestOffer.name}`);
    res.json({ rawTotal, ...bestOffer });
});

// --- 5. PORT AYARI ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 SİSTEM ÇALIŞIYOR: Port ${PORT}`);
});
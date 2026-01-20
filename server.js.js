const express = require('express');
const mongoose = require('mongoose'); // Yeni ekledik
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- 1. MONGODB BAĞLANTISI ---
// Buradaki linki kendi Atlas linkinle değiştir!
const mongoURI = "mongodb+srv://berkayfm72:<TSWveDdH6EN8dwQb>@cluster0.m1xbymq.mongodb.net/?appName=Cluster0";

mongoose.connect(mongoURI)
    .then(() => console.log("🚀 MongoDB Atlas Bağlantısı Başarılı!"))
    .catch(err => console.log("❌ MongoDB Bağlantı Hatası:", err));

// --- 2. VERİ MODELLERİ (ŞEMALAR) ---
// Artık 'let products = []' yerine bunları kullanıyoruz
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

// Ürünleri Getir
app.get('/api/products', async (req, res) => {
    const products = await Product.find(); 
    res.json(products);
});

// Yeni Ürün Ekle
app.post('/api/products', async (req, res) => {
    const newProduct = new Product({ ...req.body, id: Date.now() });
    await newProduct.save();
    console.log(`➕ Veritabanına Kaydedildi: ${newProduct.name}`);
    res.json({ message: "Ürün Kaydedildi", product: newProduct });
});

// Kampanyaları Getir
app.get('/api/campaigns', async (req, res) => {
    const campaigns = await Campaign.find();
    res.json(campaigns);
});

// Yeni Kampanya Ekle
app.post('/api/campaigns', async (req, res) => {
    const newCampaign = new Campaign({ ...req.body, id: Date.now() });
    await newCampaign.save();
    res.json({ message: "Kampanya Kaydedildi", campaign: newCampaign });
});

// --- 4. HESAPLAMA MOTORU (Calculate) ---
// Bu kısmın başına 'async' eklemeyi unutma!
app.post('/api/calculate', async (req, res) => {
    const productsDB = await Product.find();
    const campaignsDB = await Campaign.find();
    
    // ... geri kalan hesaplama kodları (içeride 'products' yerine 'productsDB' kullanacağız)

// --- HESAPLAMA MOTORU ---
app.post('/api/calculate', (req, res) => {
    console.log("\n==================================================");
    console.log("🧮 HESAPLAMA İSTEĞİ GELDİ...");
    
    const cartItems = req.body.items;
    let rawTotal = 0;
    
    // 1. Sepeti Zenginleştir (Fiyat ve Detayları Bul)
    const enrichedCart = cartItems.map(cartItem => {
        const productInfo = products.find(p => p.id == cartItem.productId);
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

    // --- İŞTE İSTEDİĞİN DETAYLI LOG BURASI ---
    console.log("📦 SEPET İÇERİĞİ:");
    enrichedCart.forEach(item => {
        console.log(`   🔸 ${item.name}`);
        console.log(`       ID: ${item.id} | Adet: ${item.qty} | Birim Fiyat: ${item.price} TL`);
    });
    console.log(`💰 Toplam Tutar (İndirimsiz): ${rawTotal} TL`);
    console.log("--------------------------------------------------");

    let bestOffer = { name: "Kampanya Yok", discount: 0, total: rawTotal };

    // 2. Kampanyaları Dene
    campaigns.forEach(camp => {
        let currentDiscount = 0;
        
        // TİP 1: 3 AL 2 ÖDE
        if (camp.type === "X_AL_Y_ODE") {
            const targetItem = enrichedCart.find(i => i.id == camp.targetProductId);
            if (targetItem && targetItem.qty >= camp.buyCount) {
                const sets = Math.floor(targetItem.qty / camp.buyCount);
                currentDiscount = ((camp.buyCount - camp.payCount) * sets) * targetItem.price;
            }
        }
        
        // TİP 2: BUNDLE
        else if (camp.type === "BUNDLE") {
            const count1 = enrichedCart.filter(i => i.category === camp.category1).reduce((acc, i) => acc + i.qty, 0);
            const count2 = enrichedCart.filter(i => i.category === camp.category2).reduce((acc, i) => acc + i.qty, 0);
            const sets = Math.min(count1, count2);
            if (sets > 0) currentDiscount = sets * camp.discountAmount;
        }

        // TİP 3: YÜZDE İNDİRİM
        else if (camp.type === "PERCENTAGE") {
            const targetItem = enrichedCart.find(i => i.id == camp.targetProductId);
            if (targetItem) {
                currentDiscount += (targetItem.price * targetItem.qty) * (camp.percent / 100);
            }
        }

        // Log: Hangi kampanya ne kadar indirim verdi?
        if (currentDiscount > 0) {
            console.log(`✅ Kampanya Uydu: "${camp.name}" -> İndirim: ${currentDiscount} TL`);
        } else {
            // console.log(`❌ Kampanya Uymadı: "${camp.name}"`); // Çok kalabalık olmasın diye kapalı
        }

        if (currentDiscount > bestOffer.discount) {
            bestOffer = { name: camp.name, discount: currentDiscount, total: rawTotal - currentDiscount };
        }
    });

    console.log(`🏆 KAZANAN KAMPANYA: "${bestOffer.name}" (${bestOffer.discount} TL İndirim)`);
    console.log("==================================================\n");

    res.json({ rawTotal, ...bestOffer });
});

// PORT AYARI: Sunucu bir port verirse onu kullan, vermezse 3000 kullan.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 SİSTEM ÇALIŞIYOR: Port ${PORT}`);
});
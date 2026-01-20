const express = require('express');
const app = express();
const path = require('path');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- VERİTABANI ---
let products = [
    { id: 101, name: "Filtre Kahve", price: 60, category: "Kahve" },
    { id: 201, name: "Cheesecake", price: 90, category: "Tatli" }
];

let campaigns = [];

// --- API ---
app.get('/api/products', (req, res) => res.json(products));
app.post('/api/products', (req, res) => {
    const newProduct = { ...req.body, id: Date.now() };
    products.push(newProduct);
    console.log(`➕ Yeni Ürün Eklendi: ${newProduct.name} (${newProduct.price} TL)`);
    res.json({ message: "Ürün Eklendi", product: newProduct });
});

app.get('/api/campaigns', (req, res) => res.json(campaigns));
app.post('/api/campaigns', (req, res) => {
    const newCampaign = { ...req.body, id: Date.now() };
    campaigns.push(newCampaign);
    console.log(`📝 Yeni Kampanya Tanımlandı: ${newCampaign.name}`);
    res.json({ message: "Kampanya Tanımlandı", campaign: newCampaign });
});

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

app.listen(3000, () => {
    console.log("🚀 SİSTEM HAZIR! http://localhost:3000 adresine git");
});
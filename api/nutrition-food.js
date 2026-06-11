// USDA food search (GET ?q=) + Open Food Facts barcode lookup (POST {barcode})
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { q } = req.query;
      if (!q) return res.status(400).json({ error: 'No query' });

      const usdaKey = process.env.USDA_API_KEY;
      if (!usdaKey) return res.status(500).json({ error: 'USDA_API_KEY not configured' });

      const r = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=5&api_key=${usdaKey}`
      );
      const data = await r.json();

      const foods = (data.foods || []).map(food => {
        const nutrients = {};
        (food.foodNutrients || []).forEach(n => {
          if (n.nutrientName?.includes('Energy') && n.unitName === 'KCAL') nutrients.calories = Math.round(n.value || 0);
          if (n.nutrientName?.includes('Carbohydrate')) nutrients.carbs = Math.round(n.value || 0);
          if (n.nutrientName?.includes('Protein')) nutrients.protein = Math.round(n.value || 0);
          if (n.nutrientName?.includes('Total lipid')) nutrients.fat = Math.round(n.value || 0);
        });
        return {
          id: food.fdcId,
          name: food.description,
          brand: food.brandOwner || null,
          serving_size: food.servingSize || 100,
          serving_unit: food.servingSizeUnit || 'g',
          per100g: {
            calories: nutrients.calories || 0,
            carbs: nutrients.carbs || 0,
            protein: nutrients.protein || 0,
            fat: nutrients.fat || 0,
          },
        };
      });

      return res.status(200).json(foods);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const { barcode } = body || {};
      if (!barcode) return res.status(400).json({ error: 'No barcode' });

      const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await r.json();

      if (data.status !== 1) return res.status(404).json({ error: 'Product not found' });

      const p = data.product;
      const n = p.nutriments || {};

      return res.status(200).json({
        id: barcode,
        name: p.product_name || 'Unknown',
        brand: p.brands || null,
        serving_size: p.serving_quantity || 100,
        serving_unit: p.serving_quantity_unit || 'g',
        per100g: {
          calories: Math.round(n['energy-kcal_100g'] || 0),
          carbs: Math.round(n.carbohydrates_100g || 0),
          protein: Math.round(n.proteins_100g || 0),
          fat: Math.round(n.fat_100g || 0),
        },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}

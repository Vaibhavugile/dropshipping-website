// src/data/dummyData.js
// Exported as CommonJS so the seeder script can require() it.

const dummyCategories = {
  "cat-electronics": {
    id: "cat-electronics",
    name: "Electronics",
    images: [],
    priceRoles: {
      retail: {
        roleName: "retail",
        rules: [
          { min: 1, max: 5, price: 1200 },
          { min: 6, max: 15, price: 1100 },
          { min: 16, max: 999999, price: 1000 }
        ]
      },
      wholesale: {
        roleName: "wholesale",
        rules: [
          { min: 1, max: 50, price: 800 },
          { min: 51, max: 999999, price: 700 }
        ]
      },
      reseller: {
        roleName: "reseller",
        rules: [
          { min: 1, max: 10, price: 1150 },
          { min: 11, max: 30, price: 1050 },
          { min: 31, max: 999999, price: 950 }
        ]
      }
    },
    products: {
      "elec-001": { id: "elec-001", productName: "Smartphone X1", productCode: "E-X1", stock: 120, images: [], variants: { colors: { black: 50, white: 40, blue: 30 } } },
      "elec-002": { id: "elec-002", productName: "Wireless Earbuds Z", productCode: "E-ZB", stock: 300, images: [] },
      "elec-003": { id: "elec-003", productName: "Bluetooth Speaker Pro", productCode: "E-SP", stock: 150, images: [] },
      "elec-004": { id: "elec-004", productName: "Smartwatch Series 3", productCode: "E-SW3", stock: 90, images: [], variants: { colors: { black: 40, silver: 30 } } },
      "elec-005": { id: "elec-005", productName: "Portable Charger 10000mAh", productCode: "E-PC10", stock: 400, images: [] },
      "elec-006": { id: "elec-006", productName: "HD Webcam 1080p", productCode: "E-WC1080", stock: 75, images: [] },
      "elec-007": { id: "elec-007", productName: "Gaming Mouse G7", productCode: "E-GM7", stock: 220, images: [], variants: { colors: { black: 120, red: 100 } } },
      "elec-008": { id: "elec-008", productName: "Mechanical Keyboard K2", productCode: "E-K2", stock: 180, images: [] },
      "elec-009": { id: "elec-009", productName: "4K Action Camera", productCode: "E-AC4K", stock: 60, images: [] },
      "elec-010": { id: "elec-010", productName: "Noise Cancelling Headphones", productCode: "E-NC1", stock: 110, images: [] }
    }
  },

  "cat-furniture": {
    id: "cat-furniture",
    name: "Furniture",
    images: [],
    priceRoles: {
      retail: {
        roleName: "retail",
        rules: [
          { min: 1, max: 3, price: 4500 },
          { min: 4, max: 10, price: 4300 },
          { min: 11, max: 999999, price: 4000 }
        ]
      },
      reseller: {
        roleName: "reseller",
        rules: [
          { min: 1, max: 5, price: 4200 },
          { min: 6, max: 999999, price: 3900 }
        ]
      }
    },
    products: {
      "furn-001": { id: "furn-001", productName: "Classic Dining Table", productCode: "F-DT1", stock: 20, images: [] },
      "furn-002": { id: "furn-002", productName: "Comfort Sofa 3-Seater", productCode: "F-SO3", stock: 15, images: [], variants: { colors: { gray: 6, blue: 5, beige: 4 } } },
      "furn-003": { id: "furn-003", productName: "Office Chair Ergonomic", productCode: "F-OC1", stock: 60, images: [], variants: { colors: { black: 35, red: 25 } } },
      "furn-004": { id: "furn-004", productName: "Bookshelf Tall 5-Shelf", productCode: "F-BS5", stock: 40, images: [] },
      "furn-005": { id: "furn-005", productName: "Queen Bed Frame", productCode: "F-BFQ", stock: 12, images: [] },
      "furn-006": { id: "furn-006", productName: "TV Stand Oak", productCode: "F-TV1", stock: 25, images: [] },
      "furn-007": { id: "furn-007", productName: "Coffee Table Round", productCode: "F-CT1", stock: 45, images: [] },
      "furn-008": { id: "furn-008", productName: "Wardrobe 3-Door", productCode: "F-WD3", stock: 10, images: [] },
      "furn-009": { id: "furn-009", productName: "Recliner Chair Deluxe", productCode: "F-RC1", stock: 8, images: [] }
    }
  },

  "cat-apparel": {
    id: "cat-apparel",
    name: "Apparel",
    images: [],
    priceRoles: {
      retail: {
        roleName: "retail",
        rules: [
          { min: 1, max: 5, price: 800 },
          { min: 6, max: 20, price: 700 },
          { min: 21, max: 999999, price: 650 }
        ]
      },
      reseller: {
        roleName: "reseller",
        rules: [
          { min: 1, max: 10, price: 750 },
          { min: 11, max: 999999, price: 700 }
        ]
      },
      foreign: {
        roleName: "foreign",
        rules: [
          { min: 1, max: 999999, price: 900 }
        ]
      }
    },
    products: {
      "app-001": { id: "app-001", productName: "Men's T-Shirt Classic", productCode: "A-TS1", stock: 400, images: [], variants: { sizes: { S: 80, M: 120, L: 120, XL: 80 }, colors: { white: 150, black: 120, navy: 130 } } },
      "app-002": { id: "app-002", productName: "Women's Polo Shirt", productCode: "A-PS1", stock: 350, images: [] },
      "app-003": { id: "app-003", productName: "Jeans Regular Fit", productCode: "A-JE1", stock: 220, images: [], variants: { sizes: { "30": 40, "32": 80, "34": 60, "36": 40 } } },
      "app-004": { id: "app-004", productName: "Hoodie Warm", productCode: "A-HD1", stock: 180, images: [] },
      "app-005": { id: "app-005", productName: "Summer Dress", productCode: "A-DR1", stock: 140, images: [] },
      "app-006": { id: "app-006", productName: "Sports Shorts", productCode: "A-SH1", stock: 260, images: [] },
      "app-007": { id: "app-007", productName: "Formal Shirt", productCode: "A-FS1", stock: 190, images: [] },
      "app-008": { id: "app-008", productName: "Kids T-Shirt Pack", productCode: "A-KT1", stock: 300, images: [] },
      "app-009": { id: "app-009", productName: "Socks 5-Pack", productCode: "A-SX1", stock: 500, images: [] },
      "app-010": { id: "app-010", productName: "Cap Adjustable", productCode: "A-CP1", stock: 420, images: [] }
    }
  },

  "cat-kitchen": {
    id: "cat-kitchen",
    name: "Kitchen & Home",
    images: [],
    priceRoles: {
      retail: {
        roleName: "retail",
        rules: [
          { min: 1, max: 10, price: 350 },
          { min: 11, max: 50, price: 300 },
          { min: 51, max: 999999, price: 260 }
        ]
      },
      wholesale: {
        roleName: "wholesale",
        rules: [
          { min: 1, max: 100, price: 220 },
          { min: 101, max: 999999, price: 200 }
        ]
      }
    },
    products: {
      "kit-001": { id: "kit-001", productName: "Non-stick Frypan 24cm", productCode: "K-FP24", stock: 160, images: [] },
      "kit-002": { id: "kit-002", productName: "Chef Knife 8inch", productCode: "K-KN8", stock: 210, images: [] },
      "kit-003": { id: "kit-003", productName: "Cutting Board Large", productCode: "K-CB1", stock: 300, images: [] },
      "kit-004": { id: "kit-004", productName: "Mixing Bowl Set (3pcs)", productCode: "K-MB3", stock: 140, images: [] },
      "kit-005": { id: "kit-005", productName: "Electric Kettle 1.7L", productCode: "K-EK17", stock: 95, images: [] },
      "kit-006": { id: "kit-006", productName: "Coffee Press 350ml", productCode: "K-CP350", stock: 130, images: [] },
      "kit-007": { id: "kit-007", productName: "Storage Jar Set", productCode: "K-SJ1", stock: 180, images: [] },
      "kit-008": { id: "kit-008", productName: "Thermal Flask 1L", productCode: "K-TF1", stock: 220, images: [] },
      "kit-009": { id: "kit-009", productName: "Silicone Spatula Set", productCode: "K-SS1", stock: 350, images: [] }
    }
  },

  "cat-toys": {
    id: "cat-toys",
    name: "Toys & Games",
    images: [],
    priceRoles: {
      retail: {
        roleName: "retail",
        rules: [
          { min: 1, max: 10, price: 450 },
          { min: 11, max: 30, price: 400 },
          { min: 31, max: 999999, price: 350 }
        ]
      },
      reseller: {
        roleName: "reseller",
        rules: [
          { min: 1, max: 20, price: 380 },
          { min: 21, max: 999999, price: 340 }
        ]
      }
    },
    products: {
      "toy-001": { id: "toy-001", productName: "Building Blocks Set", productCode: "T-BB1", stock: 500, images: [] },
      "toy-002": { id: "toy-002", productName: "Remote Car Mini", productCode: "T-RC1", stock: 220, images: [] },
      "toy-003": { id: "toy-003", productName: "Puzzle 1000pc", productCode: "T-PZ1000", stock: 140, images: [] },
      "toy-004": { id: "toy-004", productName: "Plush Bear Large", productCode: "T-PB1", stock: 320, images: [], variants: { colors: { brown: 160, white: 160 } } },
      "toy-005": { id: "toy-005", productName: "Water Gun 200ml", productCode: "T-WG1", stock: 410, images: [] },
      "toy-006": { id: "toy-006", productName: "Board Game Classic", productCode: "T-BG1", stock: 200, images: [] },
      "toy-007": { id: "toy-007", productName: "Action Figure Pack", productCode: "T-AF1", stock: 260, images: [] },
      "toy-008": { id: "toy-008", productName: "Art & Craft Kit", productCode: "T-AC1", stock: 330, images: [] },
      "toy-009": { id: "toy-009", productName: "Kinetic Sand 1kg", productCode: "T-KS1", stock: 400, images: [] },
      "toy-010": { id: "toy-010", productName: "Educational Tablet Kids", productCode: "T-ET1", stock: 85, images: [] }
    }
  },

  "cat-beauty": {
    id: "cat-beauty",
    name: "Beauty & Personal Care",
    images: [],
    priceRoles: {
      retail: {
        roleName: "retail",
        rules: [
          { min: 1, max: 10, price: 250 },
          { min: 11, max: 50, price: 220 },
          { min: 51, max: 999999, price: 200 }
        ]
      },
      wholesale: {
        roleName: "wholesale",
        rules: [
          { min: 1, max: 200, price: 180 },
          { min: 201, max: 999999, price: 160 }
        ]
      }
    },
    products: {
      "beauty-001": { id: "beauty-001", productName: "Moisturizer 100ml", productCode: "B-MO1", stock: 420, images: [] },
      "beauty-002": { id: "beauty-002", productName: "Shampoo 400ml", productCode: "B-SH1", stock: 380, images: [] },
      "beauty-003": { id: "beauty-003", productName: "Conditioner 400ml", productCode: "B-CO1", stock: 350, images: [] },
      "beauty-004": { id: "beauty-004", productName: "Lip Balm Pack", productCode: "B-LP1", stock: 500, images: [] },
      "beauty-005": { id: "beauty-005", productName: "Face Cleanser 150ml", productCode: "B-FC1", stock: 290, images: [] },
      "beauty-006": { id: "beauty-006", productName: "Hand Sanitizer 250ml", productCode: "B-HS1", stock: 600, images: [] },
      "beauty-007": { id: "beauty-007", productName: "Perfume 50ml", productCode: "B-PF1", stock: 120, images: [] },
      "beauty-008": { id: "beauty-008", productName: "Makeup Remover Wipes (50)", productCode: "B-MR1", stock: 450, images: [] }
    }
  }
};

module.exports = { dummyCategories };

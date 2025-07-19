// Collections and LiveQuery Demo
// This example demonstrates the power of rxDB2's collections with Zod schemas and liveQuery

import { z } from 'zod'
import { defineCollection } from '../packages/engine/src/database/defineCollection.js'
import { reactive } from '../packages/engine/src/reactive.js'
import { map, filter, scan } from '../packages/engine/src/operators.js'

console.log('=== Collections and LiveQuery Demo ===\n')

// ============================================================================
// 1. COMPLEX ZOD SCHEMA DEFINITION
// ============================================================================

console.log('1. Defining Complex Zod Schemas\n')

// Nested address schema
const AddressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  country: z.enum(['US', 'CA', 'UK'], { errorMap: () => ({ message: 'Invalid country code' }) })
})

// User schema with complex validation
const UserSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long'),
  email: z.string().email('Invalid email format'),
  age: z.number().int('Age must be an integer').min(18, 'Must be 18 or older').max(120, 'Invalid age'),
  isActive: z.boolean(),
  tags: z.array(z.string()).max(10, 'Too many tags'),
  address: AddressSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date()
})

// Product schema with business logic
const ProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  category: z.string().nullable(),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  isAvailable: z.boolean().default(true),
  tags: z.array(z.string()).optional().default([]),
  rating: z.number().min(1).max(5).optional()
})

// Order schema with relationships
const OrderSchema = z.object({
  id: z.string(),
  userId: z.string().uuid(),
  productId: z.string(),
  quantity: z.number().int().positive('Quantity must be positive'),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  total: z.number().positive(),
  createdAt: z.date(),
  updatedAt: z.date()
})

console.log('✅ Complex schemas defined with validation rules')
console.log('✅ Nested objects, arrays, enums, and custom validation')
console.log('✅ Optional fields, defaults, and business logic\n')

// ============================================================================
// 2. COLLECTION DEFINITION
// ============================================================================

console.log('2. Creating Collections\n')

const Users = defineCollection('users', UserSchema)
const Products = defineCollection('products', ProductSchema)
const Orders = defineCollection('orders', OrderSchema)

console.log('✅ Collections created with type safety')
console.log('✅ Runtime validation enabled')
console.log('✅ TypeScript intellisense support\n')

// ============================================================================
// 3. DATA VALIDATION DEMO
// ============================================================================

console.log('3. Data Validation Examples\n')

// Valid user data
const validUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  isActive: true,
  tags: ['developer', 'typescript'],
  address: {
    street: '123 Main St',
    city: 'New York',
    zipCode: '10001',
    country: 'US'
  },
  metadata: { lastLogin: '2024-01-01' },
  createdAt: new Date(),
  updatedAt: new Date()
}

console.log('Inserting valid user...')
const insertResult = Users.tryInsert(validUser)
if (insertResult.success) {
  console.log('✅ Valid user inserted successfully')
  console.log(`   Name: ${insertResult.data?.name}`)
  console.log(`   Email: ${insertResult.data?.email}`)
} else {
  console.log('❌ Validation failed:', insertResult.errors)
}

// Invalid user data
const invalidUser = {
  id: 'invalid-uuid',
  name: 'A', // Too short
  email: 'invalid-email',
  age: 15, // Too young
  isActive: 'not-boolean',
  tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8', 'tag9', 'tag10', 'tag11'], // Too many
  address: {
    street: '',
    city: 'NY',
    zipCode: 'invalid',
    country: 'XX' // Invalid country
  }
}

console.log('\nInserting invalid user...')
const invalidResult = Users.tryInsert(invalidUser as any)
if (!invalidResult.success) {
  console.log('❌ Validation correctly failed')
  console.log('   Errors:')
  invalidResult.errors?.forEach(error => {
    console.log(`   - ${error.path.join('.')}: ${error.message}`)
  })
}

console.log('\n')

// ============================================================================
// 4. LIVEQUERY DEMO
// ============================================================================

console.log('4. LiveQuery Examples\n')

// Insert sample data
console.log('Inserting sample data...')

// Users
Users.insert({ id: '1', name: 'Alice Johnson', email: 'alice@example.com', age: 25, isActive: true, tags: ['admin'], createdAt: new Date(), updatedAt: new Date() })
Users.insert({ id: '2', name: 'Bob Smith', email: 'bob@example.com', age: 30, isActive: true, tags: ['user'], createdAt: new Date(), updatedAt: new Date() })
Users.insert({ id: '3', name: 'Charlie Brown', email: 'charlie@example.com', age: 35, isActive: false, tags: ['user'], createdAt: new Date(), updatedAt: new Date() })

// Products
Products.insert({ id: 'prod-1', name: 'Laptop', description: 'High-performance laptop', price: 999, category: 'electronics', stock: 10, rating: 4.5 })
Products.insert({ id: 'prod-2', name: 'Mouse', description: 'Wireless mouse', price: 25, category: 'electronics', stock: 50, rating: 4.0 })
Products.insert({ id: 'prod-3', name: 'Book', description: 'Programming book', price: 15, category: 'books', stock: 0, rating: 4.8 })
Products.insert({ id: 'prod-4', name: 'Tablet', description: '10-inch tablet', price: 299, category: 'electronics', stock: 5, rating: 3.5 })

console.log('✅ Sample data inserted\n')

// Live query for active users
console.log('Live Query: Active Users')
const activeUsers = Users.find({ isActive: true })
activeUsers.subscribe((users) => {
  console.log(`   Active users: ${users.length}`)
  users.forEach(user => console.log(`   - ${user.name} (${user.email})`))
})

// Live query for low stock products
console.log('\nLive Query: Low Stock Products (< 5 items)')
const lowStockProducts = Products.find({ stock: { $lt: 5 } })
lowStockProducts.subscribe((products) => {
  console.log(`   Low stock products: ${products.length}`)
  products.forEach(product => console.log(`   - ${product.name}: ${product.stock} in stock`))
})

// Live query with complex conditions
console.log('\nLive Query: High-Rated Electronics')
const highRatedElectronics = Products.find({
  category: 'electronics',
  rating: { $gte: 4.0 }
})
highRatedElectronics.subscribe((products) => {
  console.log(`   High-rated electronics: ${products.length}`)
  products.forEach(product => console.log(`   - ${product.name}: ${product.rating}/5 stars`))
})

console.log('\n')

// ============================================================================
// 5. REACTIVE TRANSFORMATIONS
// ============================================================================

console.log('5. Reactive Transformations\n')

// Transform user data
console.log('Transforming user data...')
const userNames = activeUsers.pipe(
  map((users) => users.map(user => user.name))
)
userNames.subscribe((names) => {
  console.log(`   Active user names: ${names.join(', ')}`)
})

// Calculate total product value
console.log('\nCalculating total inventory value...')
const allProducts = Products.find({})
const totalInventoryValue = allProducts.pipe(
  map((products) => products.reduce((sum, product) => sum + (product.price * product.stock), 0))
)
totalInventoryValue.subscribe((total) => {
  console.log(`   Total inventory value: $${total.toFixed(2)}`)
})

// Product category statistics
console.log('\nProduct category statistics...')
const categoryStats = allProducts.pipe(
  map((products) => {
    const stats: Record<string, { count: number, avgPrice: number }> = {}
    products.forEach(product => {
      if (!stats[product.category || 'uncategorized']) {
        stats[product.category || 'uncategorized'] = { count: 0, avgPrice: 0 }
      }
      stats[product.category || 'uncategorized'].count++
      stats[product.category || 'uncategorized'].avgPrice += product.price
    })
    
    // Calculate averages
    Object.keys(stats).forEach(category => {
      stats[category].avgPrice /= stats[category].count
    })
    
    return stats
  })
)
categoryStats.subscribe((stats) => {
  console.log('   Category statistics:')
  Object.entries(stats).forEach(([category, data]) => {
    console.log(`   - ${category}: ${data.count} products, avg price $${data.avgPrice.toFixed(2)}`)
  })
})

console.log('\n')

// ============================================================================
// 6. REAL-TIME UPDATES
// ============================================================================

console.log('6. Real-Time Updates Demo\n')

console.log('Adding new user...')
Users.insert({ 
  id: '4', 
  name: 'Diana Wilson', 
  email: 'diana@example.com', 
  age: 28, 
  isActive: true, 
  tags: ['user'], 
  createdAt: new Date(), 
  updatedAt: new Date() 
})

console.log('Updating product stock...')
Products.update('prod-1', { stock: 2 }) // Laptop now low stock

console.log('Adding new product...')
Products.insert({ 
  id: 'prod-5', 
  name: 'Monitor', 
  description: '27-inch 4K monitor', 
  price: 399, 
  category: 'electronics', 
  stock: 8, 
  rating: 4.7 
})

console.log('\n')

// ============================================================================
// 7. BUSINESS LOGIC INTEGRATION
// ============================================================================

console.log('7. Business Logic Integration\n')

// Simulate order processing
console.log('Processing orders...')

// Create orders
Orders.insert({ 
  id: 'order-1', 
  userId: '1', 
  productId: 'prod-1', 
  quantity: 1, 
  status: 'pending', 
  total: 999, 
  createdAt: new Date(), 
  updatedAt: new Date() 
})

Orders.insert({ 
  id: 'order-2', 
  userId: '2', 
  productId: 'prod-2', 
  quantity: 2, 
  status: 'processing', 
  total: 50, 
  createdAt: new Date(), 
  updatedAt: new Date() 
})

// Live query for pending orders
const pendingOrders = Orders.find({ status: 'pending' })
pendingOrders.subscribe((orders) => {
  console.log(`   Pending orders: ${orders.length}`)
  orders.forEach(order => {
    const user = Users.findOne({ id: order.userId })
    const product = Products.findOne({ id: order.productId })
    console.log(`   - Order ${order.id}: ${user?.name} ordered ${order.quantity}x ${product?.name}`)
  })
})

// Auto-update stock when orders are confirmed
const confirmedOrders = Orders.find({ status: 'processing' })
confirmedOrders.subscribe((orders) => {
  orders.forEach(order => {
    const product = Products.findOne({ id: order.productId })
    if (product && product.stock >= order.quantity) {
      const newStock = product.stock - order.quantity
      Products.update(order.productId, { stock: newStock })
      console.log(`   ✅ Updated stock for ${product.name}: ${product.stock} → ${newStock}`)
    }
  })
})

console.log('\n')

// ============================================================================
// 8. ERROR HANDLING
// ============================================================================

console.log('8. Error Handling Examples\n')

// Try to insert invalid data
console.log('Attempting to insert invalid data...')
const invalidProduct = {
  id: 'invalid-prod',
  name: '', // Empty name
  price: -10, // Negative price
  stock: -5, // Negative stock
  category: 'electronics'
}

const productResult = Products.tryInsert(invalidProduct as any)
if (!productResult.success) {
  console.log('❌ Product validation failed:')
  productResult.errors?.forEach(error => {
    console.log(`   - ${error.path.join('.')}: ${error.message}`)
  })
}

// Try to update with invalid data
console.log('\nAttempting to update with invalid data...')
const updateResult = Products.tryUpdate('prod-1', { price: -50 })
if (!updateResult.success) {
  console.log('❌ Update validation failed:')
  updateResult.errors?.forEach(error => {
    console.log(`   - ${error.path.join('.')}: ${error.message}`)
  })
}

console.log('\n')

// ============================================================================
// 9. PERFORMANCE AND SCALABILITY
// ============================================================================

console.log('9. Performance and Scalability\n')

// Insert large dataset
console.log('Inserting large dataset...')
const startTime = Date.now()

for (let i = 0; i < 1000; i++) {
  Products.insert({
    id: `bulk-${i}`,
    name: `Product ${i}`,
    description: `Description for product ${i}`,
    price: Math.random() * 100 + 10,
    category: ['electronics', 'books', 'clothing'][Math.floor(Math.random() * 3)],
    stock: Math.floor(Math.random() * 100),
    rating: Math.floor(Math.random() * 5) + 1
  })
}

const endTime = Date.now()
console.log(`✅ Inserted 1000 products in ${endTime - startTime}ms`)

// Complex query performance
console.log('\nTesting complex query performance...')
const complexQueryStart = Date.now()

const complexResults = Products.find({
  price: { $gte: 50 },
  stock: { $gt: 0 },
  rating: { $gte: 4 }
})

const complexQueryEnd = Date.now()
console.log(`✅ Complex query completed in ${complexQueryEnd - complexQueryStart}ms`)

console.log('\n')

// ============================================================================
// SUMMARY
// ============================================================================

console.log('=== Summary ===')
console.log('✅ Complex Zod schemas with validation')
console.log('✅ Type-safe collections with runtime validation')
console.log('✅ LiveQuery for reactive data access')
console.log('✅ Real-time updates and transformations')
console.log('✅ Business logic integration')
console.log('✅ Comprehensive error handling')
console.log('✅ Performance optimization')
console.log('✅ Developer experience excellence')

console.log('\n🎉 Collections and LiveQuery demo completed successfully!') 
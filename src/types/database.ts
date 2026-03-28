export type UserRole = 'admin' | 'mesero' | 'cocina'
export type ItemType = 'daily' | 'fixed'
export type TableStatus = 'available' | 'occupied' | 'pending'
export type OrderType = 'mesa' | 'para_llevar'
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered'
export type PaymentMethod = 'cash' | 'card' | 'qr'

export interface User {
    id: string
    name: string
    role: UserRole
    created_at: string
}

export interface MenuItem {
    id: string
    name: string
    price: number
    type: ItemType
    available: boolean
    date: string | null
    created_at: string
}

export interface Table {
    id: string
    number: number
    status: TableStatus
    disabled: boolean
    created_at: string
}

export interface Order {
    id: string
    table_id: string | null
    user_id: string
    type: OrderType
    customer_name: string | null
    status: OrderStatus
    created_at: string
}

export interface OrderItem {
    id: string
    order_id: string
    menu_item_id: string
    quantity: number
    unit_price: number
}

export interface Payment {
    id: string
    order_id: string
    amount: number
    method: PaymentMethod
    paid_at: string
}

export type Database = {
    public: {
        Tables: {
            users: {
                Row: User
                Insert: Omit<User, 'created_at'>
                Update: Partial<User>
            }
            menu_items: {
                Row: MenuItem
                Insert: Omit<MenuItem, 'id' | 'created_at'>
                Update: Partial<MenuItem>
            }
            tables: {
                Row: Table
                Insert: Omit<Table, 'id' | 'created_at'>
                Update: Partial<Table>
            }
            orders: {
                Row: Order
                Insert: Omit<Order, 'id' | 'created_at'>
                Update: Partial<Order>
            }
            order_items: {
                Row: OrderItem
                Insert: Omit<OrderItem, 'id'>
                Update: Partial<OrderItem>
            }
            payments: {
                Row: Payment
                Insert: Omit<Payment, 'id'>
                Update: Partial<Payment>
            }
        }
    }
}
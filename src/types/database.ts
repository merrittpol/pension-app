export type UserRole = 'admin' | 'mesero' | 'cocina'
export type ItemType = 'daily' | 'fixed'
export type TableStatus = 'available' | 'occupied' | 'pending'
export type OrderType = 'mesa' | 'para_llevar'
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered'
export type PaymentMethod = 'cash' | 'card' | 'qr'
export type ExpenseCategory = 'ingredientes' | 'servicios' | 'personal' | 'equipamiento' | 'limpieza' | 'otros'

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

export interface Expense {
    id: string
    description: string
    amount: number
    category: ExpenseCategory
    date: string
    note: string | null
    created_at: string
}

export type Database = {
    public: {
        Tables: {
            users: {
                Row: User
                Insert: Omit<User, 'created_at'>
                Update: Partial<Omit<User, 'id'>>
            }
            menu_items: {
                Row: MenuItem
                Insert: Omit<MenuItem, 'id' | 'created_at'>
                Update: Partial<Omit<MenuItem, 'id' | 'created_at'>>
            }
            tables: {
                Row: Table
                Insert: Omit<Table, 'id' | 'created_at'>
                Update: Partial<Omit<Table, 'id' | 'created_at'>>
            }
            orders: {
                Row: Order
                Insert: Omit<Order, 'id' | 'created_at'>
                Update: Partial<Omit<Order, 'id' | 'created_at'>>
            }
            order_items: {
                Row: OrderItem
                Insert: Omit<OrderItem, 'id'>
                Update: Partial<Omit<OrderItem, 'id'>>
            }
            payments: {
                Row: Payment
                Insert: Omit<Payment, 'id'>
                Update: Partial<Omit<Payment, 'id'>>
            }
            expenses: {
                Row: Expense
                Insert: Omit<Expense, 'id' | 'created_at'>
                Update: Partial<Omit<Expense, 'id' | 'created_at'>>
            }
        }
        Functions: {
            get_sales_report: {
                Args: {
                    period_type: string
                    date_from: string
                    date_to: string
                }
                Returns: {
                    period_start: string
                    total_sales: number
                    order_count: number
                }[]
            }
            my_role: {
                Args: Record<string, never>
                Returns: UserRole
            }
        }
    }
}
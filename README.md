# ERP System - Manufacturing Management

A comprehensive Enterprise Resource Planning (ERP) system built with React, Vite, and Tailwind CSS, designed specifically for manufacturing businesses.

## Features

### Core Modules
- **Dashboard** - Overview of key metrics and upcoming production
- **Products** - Product catalog management
- **Inventory** - Stock level tracking and management
- **Formulas** - Recipe and formulation management
- **Production Schedule** - Production planning and scheduling
- **Purchase Orders** - Supplier order management
- **Completed Orders** - Order history and tracking
- **Content Library** - Document and media management
- **Customers** - Customer relationship management
- **Suppliers** - Supplier management and ratings
- **Team Chat** - Real-time team communication
- **AI Insights** - Intelligent analytics and recommendations

### Key Features
- Modern, responsive UI built with Tailwind CSS
- Real-time data visualization
- Comprehensive search and filtering
- Role-based navigation
- Mobile-friendly design
- Integrated team communication
- AI-powered insights and predictions

## Technology Stack

- **Frontend**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Routing**: React Router DOM

## Getting Started

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone the repository or navigate to the project directory
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/
│   └── Layout.jsx          # Main layout with sidebar navigation
├── pages/
│   ├── Dashboard.jsx       # Dashboard with metrics and overview
│   ├── Products.jsx        # Product management
│   ├── Inventory.jsx       # Inventory tracking
│   ├── Formulas.jsx        # Recipe management
│   ├── ProductionSchedule.jsx # Production planning
│   ├── PurchaseOrders.jsx  # Purchase order management
│   ├── CompletedOrders.jsx # Order history
│   ├── ContentLibrary.jsx  # Document management
│   ├── Customers.jsx       # Customer management
│   ├── Suppliers.jsx       # Supplier management
│   ├── TeamChat.jsx        # Team communication
│   └── AIInsights.jsx      # AI analytics
├── App.jsx                 # Main app component with routing
├── main.jsx               # Application entry point
└── index.css              # Tailwind CSS imports
```

## Features by Page

### Dashboard
- Key performance metrics
- Active purchase orders tracking
- Materials to order alerts
- Orders ready for invoicing/shipping
- Upcoming production schedule
- Recent activity feed
- Quick action buttons

### Products
- Product catalog with search and filtering
- SKU management
- Category organization
- Pricing and cost tracking
- Stock level monitoring
- Product status management

### Inventory
- Real-time stock levels
- Low stock alerts
- Min/max stock thresholds
- Category-based organization
- Cost tracking
- Inventory value calculations

### Production Schedule
- Weekly/monthly production planning
- Resource allocation
- Priority management
- Status tracking (Scheduled, In Progress, Completed)
- Team assignment
- Timeline management

### Team Chat
- Real-time messaging
- Channel-based communication
- Team member status
- File sharing capabilities
- Message search
- Online presence indicators

### AI Insights
- Production efficiency recommendations
- Demand forecasting
- Cost optimization suggestions
- Quality predictions
- Intelligent alerts
- Performance analytics

## Customization

The application is built with modularity in mind. You can easily:

1. **Add new pages** - Create new components in the `pages/` directory and add routes in `App.jsx`
2. **Modify the layout** - Update the `Layout.jsx` component to change navigation or styling
3. **Customize styling** - Modify Tailwind classes or add custom CSS
4. **Add new features** - Extend existing components or create new ones

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please contact the development team or create an issue in the repository.

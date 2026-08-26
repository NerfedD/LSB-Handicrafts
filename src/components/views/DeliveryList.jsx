import React, { useState } from 'react';
import { Plus, ChevronDown, Trash2, Truck, Edit2, Eye } from '../icons';
import EmptyState from '../shared/EmptyState';
import StatusDotLabel from '../shared/StatusDotLabel';
import ListHeaderBar from '../shared/ListHeaderBar';

export function DeliveryList({ deliveries, setDeliveries, orders = [], navigateTo, showModal, addActivity }) {
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [locationFilter, setLocationFilter] = useState('All Locations');
  const [sortOption, setSortOption] = useState('location-az');
  const [expandedDeliveryId, setExpandedDeliveryId] = useState(null);
  const [deliveryType, setDeliveryType] = useState('all'); // 'all', 'products', 'orders'
  
  const isOrderDelivery = (delivery) => {
    return /Order #\d+/.test(delivery.product);
  };
  
  const getOrderFromDelivery = (delivery) => {
    const orderMatch = delivery.product.match(/Order #(\d+)/);
    if (!orderMatch) return null;
    const orderId = parseInt(orderMatch[1], 10);
    return orders.find(o => o.id === orderId) || null;
  };
  
  const getOrderCreatedAt = (delivery) => {
    const orderMatch = delivery.product.match(/Order #(\d+)/);
    if (!orderMatch) return delivery.createdAt;
    const orderId = parseInt(orderMatch[1], 10);
    const order = orders.find(o => o.id === orderId);
    return order?.createdAt || delivery.createdAt;
  };

  const sortDeliveries = (items) => {
    return [...items].sort((a, b) => {
      switch (sortOption) {
        case 'location-az':
          return a.location.localeCompare(b.location);
        case 'location-za':
          return b.location.localeCompare(a.location);
        case 'amount-desc':
          return (b.amount || 0) - (a.amount || 0);
        case 'amount-asc':
          return (a.amount || 0) - (b.amount || 0);
        case 'order-created-newest': {
          const dateA = Date.parse(getOrderCreatedAt(a));
          const dateB = Date.parse(getOrderCreatedAt(b));
          return dateB - dateA;
        }
        case 'order-created-oldest': {
          const dateA = Date.parse(getOrderCreatedAt(a));
          const dateB = Date.parse(getOrderCreatedAt(b));
          return dateA - dateB;
        }
        case 'status-priority': {
          const statusOrder = { 'Not Yet Delivered': 0, 'On The Way': 1, 'Delivered': 2 };
          return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
        }
        default:
          return 0;
      }
    });
  };

  const handleDelete = (id) => {
    const deletedDelivery = deliveries.find(d => d.id === id);
    showModal(
      "Delete Delivery",
      "Are you sure you want to remove this delivery record?",
      () => {
        setDeliveries(deliveries.filter(d => d.id !== id));
        if (deletedDelivery) {
          addActivity?.({
            type: 'Delivery',
            title: 'Delivery Deleted',
            description: `Deleted delivery: ${deletedDelivery.product} to ${deletedDelivery.location}`,
            color: 'bg-orange-500'
          });
        }
      }
    );
  };

  const handleStatusChange = (id, newStatus) => {
    setDeliveries(deliveries.map(d => d.id === id ? { ...d, status: newStatus } : d));
  };

  const filteredDeliveries = deliveries.filter(delivery => {
    const matchesStatus = statusFilter === 'All Status' || delivery.status === statusFilter;
    const matchesLocation = locationFilter === 'All Locations' || delivery.location === locationFilter;
    const matchesType = 
      deliveryType === 'all' ||
      (deliveryType === 'orders' && isOrderDelivery(delivery)) ||
      (deliveryType === 'products' && !isOrderDelivery(delivery));
    return matchesStatus && matchesLocation && matchesType;
  });

  const sortedDeliveries = sortDeliveries(filteredDeliveries);
  const uniqueLocations = [...new Set(deliveries.map(d => d.location))];

  return (
    <div className="animate-in fade-in duration-300 w-full">
      <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl overflow-hidden shadow-sm dark:shadow-lg w-full">
        <ListHeaderBar description="Manage product deliveries and track their status">
          <div className="flex flex-col gap-4 w-full">
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setDeliveryType('all')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  deliveryType === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-zinc-200 dark:bg-[#1A1A24] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-[#272730]'
                }`}
              >
                All Deliveries
              </button>
              <button 
                onClick={() => setDeliveryType('products')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  deliveryType === 'products' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-zinc-200 dark:bg-[#1A1A24] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-[#272730]'
                }`}
              >
                Products
              </button>
              <button 
                onClick={() => setDeliveryType('orders')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  deliveryType === 'orders' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-zinc-200 dark:bg-[#1A1A24] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-[#272730]'
                }`}
              >
                Orders
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <select 
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="appearance-none bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl pl-4 pr-10 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500/50 cursor-pointer w-full"
              >
                <option value="location-az" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Delivery Location (A → Z)</option>
                <option value="location-za" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Delivery Location (Z → A)</option>
                <option value="amount-desc" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Amount (Largest → Smallest)</option>
                <option value="amount-asc" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Amount (Smallest → Largest)</option>
                <option value="order-created-newest" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Order Creation Date (Newest → Oldest)</option>
                <option value="order-created-oldest" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Order Creation Date (Oldest → Newest)</option>
                <option value="status-priority" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Delivery Status (Pending → In Progress → Delivered)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
            </div>
            <div className="relative w-full sm:w-auto">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl pl-4 pr-10 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500/50 cursor-pointer w-full"
              >
                <option value="All Status" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">All Status</option>
                <option value="Not Yet Delivered" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Not Yet Delivered</option>
                <option value="On The Way" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">On The Way</option>
                <option value="Delivered" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Delivered</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
            </div>
            <div className="relative w-full sm:w-auto">
              <select 
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="appearance-none bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl pl-4 pr-10 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500/50 cursor-pointer w-full"
              >
                <option value="All Locations" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">All Locations</option>
                {uniqueLocations.map(location => (
                  <option key={location} value={location} className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">{location}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
            </div>
            <button 
              onClick={() => navigateTo('add-delivery')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap w-full sm:w-auto shadow-[0_0_15px_rgba(37,99,235,0.2)]"
            >
              <Plus size={16} /> Add Delivery
            </button>
            </div>
          </div>
        </ListHeaderBar>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-[#1F1F2E] text-zinc-500 bg-zinc-50/50 dark:bg-transparent">
                <th className="px-4 md:px-6 py-4 font-semibold text-xs tracking-wider uppercase">Product</th>
                <th className="px-4 py-4 font-semibold text-xs tracking-wider uppercase">Size</th>
                <th className="px-4 py-4 font-semibold text-xs tracking-wider uppercase">Amount</th>
                <th className="px-4 py-4 font-semibold text-xs tracking-wider uppercase">Location</th>
                <th className="px-4 py-4 font-semibold text-xs tracking-wider uppercase">Status</th>
                <th className="px-4 py-4 font-semibold text-xs tracking-wider uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-[#1F1F2E]">
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-zinc-500 dark:text-zinc-400">
                    <EmptyState
                      title="No deliveries found"
                      description="Create your first delivery record to start tracking status."
                      icon={<Truck size={22} />}
                    />
                  </td>
                </tr>
              ) : (
                sortedDeliveries.map((delivery) => {
                  const order = delivery.size === 'Order Package' ? getOrderFromDelivery(delivery) : null;
                  const isExpanded = expandedDeliveryId === delivery.id;
                  return (
                    <React.Fragment key={delivery.id}>
                      <tr className="hover:bg-zinc-50 dark:hover:bg-[#1A1A24]/30 transition-colors">
                        <td className="px-4 md:px-6 py-5 flex items-center gap-3">
                          <StatusDotLabel
                            label={delivery.product}
                            ariaLabel={`Delivery product: ${delivery.product}`}
                            dotClassName={
                              delivery.status === 'Not Yet Delivered' ? 'bg-red-500' :
                              delivery.status === 'Delivered' ? 'bg-emerald-500' :
                              'bg-yellow-500'
                            }
                            textClassName="text-zinc-900 dark:text-zinc-100"
                          />
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex flex-col gap-2">
                            <span className="text-zinc-600 dark:text-zinc-400">{delivery.size}</span>
                            {order && (
                              <button
                                onClick={() => setExpandedDeliveryId(isExpanded ? null : delivery.id)}
                                className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-medium transition-colors text-left"
                              >
                                {isExpanded ? '✕ Close' : '⊕ Order Details'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-5 text-zinc-900 dark:text-zinc-100 font-medium">{delivery.amount || '-'}</td>
                        <td className="px-4 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400 dark:text-zinc-500">📍</span>
                            <span className="text-zinc-600 dark:text-zinc-400">{delivery.location}</span>
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="relative inline-block w-[140px] md:w-[150px]">
                            <select
                              value={delivery.status}
                              onChange={(e) => handleStatusChange(delivery.id, e.target.value)}
                              aria-label={`Delivery status for ${delivery.product}`}
                              title={`Current status: ${delivery.status}`}
                              className={`appearance-none w-full outline-none pr-8 pl-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                                delivery.status === 'Not Yet Delivered' 
                                  ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100 dark:border-red-900/50 dark:text-red-500 dark:bg-red-950/20 dark:hover:bg-red-950/40' 
                                  : delivery.status === 'Delivered'
                                  ? 'border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900/50 dark:text-emerald-500 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40'
                                  : 'border-yellow-200 text-yellow-600 bg-yellow-50 hover:bg-yellow-100 dark:border-yellow-900/50 dark:text-yellow-500 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/40'
                              }`}
                            >
                              <option value="Not Yet Delivered" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Not Yet Delivered</option>
                              <option value="On The Way" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">On The Way</option>
                              <option value="Delivered" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Delivered</option>
                            </select>
                            <ChevronDown size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-70 ${
                              delivery.status === 'Not Yet Delivered' ? 'text-red-600 dark:text-red-500' : delivery.status === 'Delivered' ? 'text-emerald-600 dark:text-emerald-500' : 'text-yellow-600 dark:text-yellow-500'
                            }`} />
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-5 text-right flex items-center justify-end gap-1">
                          <button 
                            onClick={() => {
                              console.log('EYE BUTTON CLICKED! Delivery:', delivery);
                              navigateTo('delivery-detail', delivery);
                            }}
                            title="View Delivery"
                            className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors inline-block p-2"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => navigateTo('edit-delivery', delivery)}
                            title="Edit Delivery"
                            className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors inline-block p-2"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(delivery.id)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors inline-block p-2"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                      {isExpanded && order && (
                        <tr className="bg-zinc-50 dark:bg-[#0a0a0f] border-b border-zinc-100 dark:border-[#1F1F2E]">
                          <td colSpan="6" className="px-4 md:px-6 py-6">
                            <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#272730] rounded-lg p-4 max-w-2xl">
                              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Order Items for {order.customerName}</h4>
                              <div className="space-y-3">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-start p-3 bg-zinc-50 dark:bg-[#1A1A24] rounded-lg border border-zinc-200 dark:border-[#272730]">
                                    <div className="flex-1">
                                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</p>
                                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Qty: {item.quantity} × PHP {item.price.toFixed(2)}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">PHP {(item.quantity * item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="border-t border-zinc-200 dark:border-[#272730] mt-4 pt-4 flex justify-between">
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Order Total:</span>
                                <span className="font-bold text-lg text-blue-600 dark:text-blue-400">PHP {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AddDelivery({ record, navigateTo, inventory, deliveries, setDeliveries, orders = [], showModal }) {
  const [formData, setFormData] = useState({
    sourceType: record ? 'order' : 'product', // 'product' or 'order'
    selectedOrderId: record?.id || '',
    product: record ? `Order #${record.id} - ${record.customerName}` : '',
    amount: record ? record.items.reduce((sum, item) => sum + item.quantity, 0) : '',
    location: '',
    status: 'Not Yet Delivered'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!formData.product) return;
    
    showModal(
      "Add Delivery",
      "Are you sure you want to add this new delivery record?",
      () => {
        let size = 'Standard';
        if (formData.sourceType === 'product') {
          const sizeMatch = formData.product.match(/(\d+(?:\.\d+)?\s*\w+(?:\/\d+\s*\w+)?)$/);
          size = sizeMatch ? sizeMatch[1] : 'Standard';
        } else {
          size = 'Order Package';
        }

        const newDel = {
          id: Date.now(),
          product: formData.product,
          size: size,
          amount: Number(formData.amount),
          location: formData.location || 'Davao City',
          status: formData.status,
          createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };

        setDeliveries([newDel, ...deliveries]);
        navigateTo('deliveries');
      }
    );
  };

  const handleOrderChange = (orderId) => {
    const order = orders.find(o => o.id === parseInt(orderId));
    if (order) {
      setFormData({
        ...formData,
        selectedOrderId: orderId,
        product: `Order #${order.id} - ${order.customerName}`,
        amount: order.items.reduce((sum, item) => sum + item.quantity, 0)
      });
    }
  };

  return (
    <div className="animate-in fade-in duration-300 w-full">
      <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl overflow-hidden shadow-sm dark:shadow-lg p-4 md:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Manage product deliveries and track their status</p>
          <button className="w-full sm:w-auto bg-blue-100 text-blue-400 dark:bg-blue-600/50 dark:text-white/50 px-5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-not-allowed">
            <Plus size={16} /> Add Delivery
          </button>
        </div>

        <div className="bg-zinc-50 dark:bg-[#181820] border border-zinc-200 dark:border-[#272730] rounded-xl p-4 md:p-6 mb-8">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Add New Delivery</h3>
          
          <div className="flex gap-4 mb-6">
            <button 
              onClick={() => setFormData({...formData, sourceType: 'product', product: '', selectedOrderId: ''})}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${formData.sourceType === 'product' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-[#1A1A24] text-zinc-600 dark:text-zinc-400'}`}
            >
              From Product
            </button>
            <button 
              onClick={() => setFormData({...formData, sourceType: 'order', product: '', selectedOrderId: ''})}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${formData.sourceType === 'order' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-[#1A1A24] text-zinc-600 dark:text-zinc-400'}`}
            >
              From Order
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row items-end gap-4 w-full">
            {formData.sourceType === 'product' ? (
              <div className="flex-1 w-full space-y-2">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Product <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select required value={formData.product} onChange={e => setFormData({...formData, product: e.target.value})} className="appearance-none w-full bg-white dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500/50 cursor-pointer">
                    <option value="" disabled className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Select product</option>
                    {inventory.map(i => <option key={i.id} value={i.name} className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">{i.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" size={16} />
                </div>
              </div>
            ) : (
              <div className="flex-1 w-full space-y-2">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Order <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select required value={formData.selectedOrderId} onChange={e => handleOrderChange(e.target.value)} className="appearance-none w-full bg-white dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500/50 cursor-pointer">
                    <option value="" disabled className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Select order</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id} className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">
                        #{o.id.toString().slice(-6)} - {o.customerName} (₱{o.totalAmount.toLocaleString()})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" size={16} />
                </div>
              </div>
            )}
            <div className="w-full lg:w-32 space-y-2">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Amount <span className="text-red-500">*</span></label>
              <div className="relative">
                <input 
                  required 
                  type="number"
                  min="1"
                  value={formData.amount} 
                  onChange={e => setFormData({...formData, amount: e.target.value})} 
                  placeholder="0"
                  className="w-full bg-white dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>
            <div className="flex-1 w-full space-y-2">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Location <span className="text-red-500">*</span></label>
              <div className="relative">
                <input 
                  required 
                  type="text"
                  value={formData.location} 
                  onChange={e => setFormData({...formData, location: e.target.value})} 
                  placeholder="Enter location"
                  className="w-full bg-white dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>
            <div className="flex-1 w-full space-y-2">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Initial Status</label>
              <div className="relative">
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="appearance-none w-full bg-white dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500/50 cursor-pointer">
                  <option value="Not Yet Delivered" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Not Yet Delivered</option>
                  <option value="On The Way" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">On The Way</option>
                  <option value="Delivered" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Delivered</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" size={16} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto pt-2 lg:pt-0">
              <button type="submit" className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors">
                Add
              </button>
              <button type="button" onClick={() => navigateTo('deliveries')} className="w-full sm:w-auto justify-center bg-transparent hover:bg-zinc-200 dark:hover:bg-[#1A1A24] text-zinc-700 dark:text-zinc-300 px-4 py-3 rounded-xl text-sm font-medium transition-colors border border-transparent">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
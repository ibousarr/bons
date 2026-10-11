import React, { useState, useEffect } from 'react';
import {
  FileText,
  Send,
  Plus,
  Server,
  Code2,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  ExternalLink,
  Download,
  Building2,
  Mail,
  Shield,
  Key,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Check,
  Copy,
  ChevronRight,
  Terminal,
  Settings,
  UserCheck
} from 'lucide-react';
import JSZip from 'jszip';

// Types
interface Supplier {
  id: number;
  name: string;
  contact_name?: string;
  email: string;
  phone?: string;
  address?: string;
  siret?: string;
  payment_terms?: string;
  notes?: string;
  created_at: string;
}

interface OrderItem {
  id?: number;
  reference?: string;
  description: string;
  quantity: number;
  unit_price_ht: number;
  tva_rate: number;
  total_ht?: number;
  total_ttc?: number;
}

interface PurchaseOrder {
  id: number;
  order_number: string;
  supplier_id: number;
  user_id: number;
  status: 'BROUILLON' | 'EN_ATTENTE' | 'VALIDE' | 'ENVOYE' | 'RECEPTIONNE' | 'ANNULE';
  order_date: string;
  expected_delivery_date?: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  payment_terms?: string;
  delivery_address?: string;
  notes?: string;
  email_sent_at?: string;
  email_sent_to?: string;
  email_status?: string;
  created_at: string;
  supplier?: Supplier;
  creator?: {
    id: number;
    email: string;
    full_name: string;
    role: string;
  };
  items?: OrderItem[];
}

interface EmailLog {
  id: number;
  orderId?: number;
  recipient: string;
  subject: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  smtpHost: string;
  sentAt: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers' | 'smtp' | 'api' | 'code' | 'guide'>('orders');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modals & Viewers
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [isSendEmailOpen, setIsSendEmailOpen] = useState(false);
  const [orderToSend, setOrderToSend] = useState<PurchaseOrder | null>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  // Email sending state
  const [customEmailMessage, setCustomEmailMessage] = useState('Veuillez trouver ci-joint notre bon de commande officiel. Merci de nous confirmer sa bonne réception ainsi que vos délais de livraison.');
  const [recipientOverride, setRecipientOverride] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailAlert, setEmailAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // SMTP Settings & Test
  const [smtpConfig, setSmtpConfig] = useState({
    host: 'mail.lws.fr',
    port: 465,
    useSsl: true,
    useTls: false,
    user: 'contact@votredomaine.com',
    password: '',
    companyName: 'Mon Entreprise SAS'
  });
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  // Code Explorer state
  const [projectFiles, setProjectFiles] = useState<Array<{ path: string; name: string; isDir: boolean }>>([]);
  const [selectedFilePath, setSelectedFilePath] = useState('app/main.py');
  const [fileContent, setFileContent] = useState('');
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // API Tester state
  const [apiEndpoint, setApiEndpoint] = useState<'orders_get' | 'orders_post' | 'auth_login' | 'mail_test' | 'suppliers_get'>('orders_get');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiTestingLoading, setApiTestingLoading] = useState(false);

  // Form State for new order
  const [newOrderSupplierId, setNewOrderSupplierId] = useState<number>(1);
  const [newOrderNotes, setNewOrderNotes] = useState('');
  const [newOrderDeliveryDate, setNewOrderDeliveryDate] = useState('');
  const [newOrderPaymentTerms, setNewOrderPaymentTerms] = useState('Virement bancaire 30 jours net');
  const [newOrderDeliveryAddress, setNewOrderDeliveryAddress] = useState('Siège Social - 10 Rue du Commerce, 75001 Paris');
  const [newOrderItems, setNewOrderItems] = useState<Array<{ reference: string; description: string; quantity: number; unit_price_ht: number; tva_rate: number }>>([
    { reference: 'REF-001', description: 'Licences logicielles annuelles Pro', quantity: 2, unit_price_ht: 250.0, tva_rate: 20.0 }
  ]);

  // Form State for new supplier
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [newSupplierSiret, setNewSupplierSiret] = useState('');
  const [newSupplierPaymentTerms, setNewSupplierPaymentTerms] = useState('30 jours net');

  // Load initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, suppliersRes, logsRes] = await Promise.all([
        fetch('/api/orders').then((r) => r.json()),
        fetch('/api/suppliers').then((r) => r.json()),
        fetch('/api/mail/logs').then((r) => r.json())
      ]);
      setOrders(ordersRes);
      setSuppliers(suppliersRes);
      setEmailLogs(logsRes);
      if (suppliersRes.length > 0) {
        setNewOrderSupplierId(suppliersRes[0].id);
      }
    } catch (e) {
      console.error('Erreur chargement données', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    loadProjectFiles();
  }, []);

  const loadProjectFiles = async () => {
    try {
      const res = await fetch('/api/project-files/tree');
      const files = await res.json();
      setProjectFiles(files);
      loadFileContent('app/main.py');
    } catch (e) {
      console.error('Erreur chargement fichiers', e);
    }
  };

  const loadFileContent = async (path: string) => {
    try {
      setSelectedFilePath(path);
      const res = await fetch(`/api/project-files/content?file=${encodeURIComponent(path)}`);
      const data = await res.json();
      setFileContent(data.content || '');
    } catch (e) {
      console.error('Erreur lecture fichier', e);
    }
  };

  // Download complete FastAPI project as ZIP
  const handleDownloadZip = async () => {
    setIsDownloadingZip(true);
    try {
      const res = await fetch('/api/project-files/all');
      const data = await res.json();
      const zip = new JSZip();

      const folder = zip.folder('fastapi-bons-de-commande');
      for (const [filePath, content] of Object.entries(data.files as Record<string, string>)) {
        folder?.file(filePath, content);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fastapi-gestion-commandes-lws.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur génération ZIP', err);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Handle Order Creation
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        supplier_id: newOrderSupplierId,
        notes: newOrderNotes,
        expected_delivery_date: newOrderDeliveryDate || null,
        payment_terms: newOrderPaymentTerms,
        delivery_address: newOrderDeliveryAddress,
        items: newOrderItems
      };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsCreateOrderOpen(false);
        // Reset form
        setNewOrderItems([
          { reference: 'REF-001', description: 'Article standard', quantity: 1, unit_price_ht: 100.0, tva_rate: 20.0 }
        ]);
        setNewOrderNotes('');
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Status Update
  const handleUpdateStatus = async (orderId: number, status: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders(orders.map((o) => (o.id === orderId ? updated : o)));
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(updated);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Send Order Email via LWS
  const handleSendOrderEmail = async () => {
    if (!orderToSend) return;
    setIsSendingEmail(true);
    setEmailAlert(null);
    try {
      const payload = {
        recipient_email: recipientOverride || orderToSend.supplier?.email,
        custom_message: customEmailMessage,
        smtp_override: {
          host: smtpConfig.host,
          port: smtpConfig.port,
          useSsl: smtpConfig.useSsl,
          user: smtpConfig.user,
          password: smtpConfig.password
        }
      };

      const res = await fetch(`/api/orders/${orderToSend.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setEmailAlert({ type: 'success', message: data.message });
        setTimeout(() => {
          setIsSendEmailOpen(false);
          setEmailAlert(null);
          fetchData();
        }, 2200);
      } else {
        setEmailAlert({ type: 'error', message: data.detail || 'Erreur lors de l’envoi' });
      }
    } catch (err: any) {
      setEmailAlert({ type: 'error', message: err.message || 'Erreur réseau' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Handle SMTP Connection Test
  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await fetch('/api/mail/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpConfig)
      });
      const data = await res.json();
      setSmtpTestResult(data);
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        message: 'Impossible de joindre le service de test.',
        details: err.message
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  // Handle Add Supplier
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupplierName,
          email: newSupplierEmail,
          contact_name: newSupplierContact,
          phone: newSupplierPhone,
          address: newSupplierAddress,
          siret: newSupplierSiret,
          payment_terms: newSupplierPaymentTerms
        })
      });
      if (res.ok) {
        setIsSupplierModalOpen(false);
        setNewSupplierName('');
        setNewSupplierEmail('');
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Interactive API Sandbox Runner
  const handleRunApiTest = async () => {
    setApiTestingLoading(true);
    try {
      let res;
      if (apiEndpoint === 'orders_get') {
        res = await fetch('/api/orders');
      } else if (apiEndpoint === 'suppliers_get') {
        res = await fetch('/api/suppliers');
      } else if (apiEndpoint === 'auth_login') {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@entreprise.com', password: 'Admin1234!' })
        });
      } else if (apiEndpoint === 'mail_test') {
        res = await fetch('/api/mail/config-info');
      } else if (apiEndpoint === 'orders_post') {
        res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplier_id: 1,
            notes: 'Test via Swagger Runner',
            items: [{ description: 'Test Article API', quantity: 1, unit_price_ht: 50, tva_rate: 20 }]
          })
        });
      }
      if (res) {
        const json = await res.json();
        setApiResponse({ status: res.status, ok: res.ok, data: json });
      }
    } catch (err: any) {
      setApiResponse({ error: err.message });
    } finally {
      setApiTestingLoading(false);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.supplier?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter ? o.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VALIDE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"><CheckCircle2 className="w-3.5 h-3.5" /> Validé</span>;
      case 'ENVOYE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200"><Mail className="w-3.5 h-3.5" /> Envoyé LWS</span>;
      case 'RECEPTIONNE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200"><Check className="w-3.5 h-3.5" /> Réceptionné</span>;
      case 'EN_ATTENTE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200"><Clock className="w-3.5 h-3.5" /> En attente</span>;
      case 'ANNULE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200"><AlertCircle className="w-3.5 h-3.5" /> Annulé</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200"><Clock className="w-3.5 h-3.5" /> Brouillon</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight">FastAPI Commandes</span>
                <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded font-mono font-medium border border-blue-500/30">
                  LWS SMTP Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Backend REST &bull; Authentification JWT &bull; Relais Mail LWS (Port 465 SSL)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadZip}
              disabled={isDownloadingZip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
              title="Télécharger l'intégralité du code Python prêt pour LWS"
            >
              <Download className={`w-3.5 h-3.5 ${isDownloadingZip ? 'animate-bounce' : ''}`} />
              {isDownloadingZip ? 'Génération ZIP...' : 'Télécharger FastAPI (.zip)'}
            </button>

            <div className="hidden md:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700 text-xs text-slate-300">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admin Achats</span>
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.2 rounded font-mono">JWT Actif</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-950 px-4 sm:px-6 lg:px-8 border-t border-slate-800/60 flex space-x-1 sm:space-x-4 overflow-x-auto">
          {[
            { id: 'orders', label: 'Bons de Commande', icon: FileText, count: orders.length },
            { id: 'suppliers', label: 'Fournisseurs', icon: Building2, count: suppliers.length },
            { id: 'smtp', label: 'Diagnostic SMTP LWS', icon: Mail },
            { id: 'api', label: 'Console API / Swagger', icon: Terminal },
            { id: 'code', label: 'Code FastAPI Python', icon: Code2 },
            { id: 'guide', label: 'Guide Déploiement LWS', icon: BookOpen }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-400 bg-slate-900/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-500/30 text-blue-200' : 'bg-slate-800 text-slate-400'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ========================================================================= */}
        {/* ONGLET 1 : BONS DE COMMANDE */}
        {/* ========================================================================= */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Header Actions & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par n° de bon ou fournisseur..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 px-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Tous les statuts</option>
                    <option value="BROUILLON">Brouillon</option>
                    <option value="VALIDE">Validé</option>
                    <option value="ENVOYE">Envoyé LWS</option>
                    <option value="RECEPTIONNE">Réceptionné</option>
                    <option value="ANNULE">Annulé</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreateOrderOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Nouveau Bon de Commande
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                    <tr>
                      <th className="px-6 py-3.5">Numéro & Date</th>
                      <th className="px-6 py-3.5">Fournisseur</th>
                      <th className="px-6 py-3.5">Montant HT</th>
                      <th className="px-6 py-3.5">Total TTC</th>
                      <th className="px-6 py-3.5">Statut</th>
                      <th className="px-6 py-3.5">Expédition LWS</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          Aucun bon de commande trouvé. Créez-en un nouveau !
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900 font-mono">{order.order_number}</span>
                            <div className="text-xs text-slate-400">
                              {new Date(order.order_date).toLocaleDateString('fr-FR')}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">{order.supplier?.name || 'Fournisseur inconnu'}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {order.supplier?.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono font-medium text-slate-700">
                            {order.total_ht.toFixed(2)} €
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-slate-900">
                            {order.total_ttc.toFixed(2)} €
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(order.status)}
                          </td>
                          <td className="px-6 py-4 text-xs">
                            {order.email_sent_at ? (
                              <div className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-block border border-emerald-200">
                                <strong>Envoyé le {new Date(order.email_sent_at).toLocaleDateString('fr-FR')}</strong>
                                <div className="text-[11px] text-emerald-600 truncate max-w-[140px]">{order.email_sent_to}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Non expédié</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right space-x-1">
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Voir les détails et articles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setOrderToSend(order);
                                setRecipientOverride(order.supplier?.email || '');
                                setIsSendEmailOpen(true);
                              }}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                              title="Envoyer par email via LWS"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ONGLET 2 : FOURNISSEURS */}
        {/* ========================================================================= */}
        {activeTab === 'suppliers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Référentiel Fournisseurs</h2>
                <p className="text-xs text-slate-500">Coordonnées, adresses de facturation et contacts de messagerie pour les envois LWS.</p>
              </div>
              <button
                onClick={() => setIsSupplierModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
              >
                <Plus className="w-4 h-4" />
                Ajouter un Fournisseur
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {suppliers.map((sup) => (
                <div key={sup.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{sup.name}</h3>
                      {sup.contact_name && (
                        <p className="text-xs text-slate-500 font-medium">Att. : {sup.contact_name}</p>
                      )}
                    </div>
                    <span className="p-2 bg-slate-100 rounded-lg text-slate-500">
                      <Building2 className="w-5 h-5" />
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <a href={`mailto:${sup.email}`} className="text-blue-600 hover:underline font-mono">
                        {sup.email}
                      </a>
                    </div>
                    {sup.phone && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">Tél:</span>
                        <span>{sup.phone}</span>
                      </div>
                    )}
                    {sup.siret && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">SIRET:</span>
                        <span className="font-mono">{sup.siret}</span>
                      </div>
                    )}
                    {sup.payment_terms && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">Conditions:</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">{sup.payment_terms}</span>
                      </div>
                    )}
                    {sup.address && (
                      <div className="text-slate-500 pt-1 border-t border-slate-100">
                        {sup.address}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ONGLET 3 : DIAGNOSTIC & CONFIGURATION SMTP LWS */}
        {/* ========================================================================= */}
        {activeTab === 'smtp' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne de Configuration & Test */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Server className="w-5 h-5 text-blue-600" />
                      Configuration SMTP Hébergeur LWS
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Paramètres du serveur sortant LWS pour l'envoi automatisé des bons de commande.
                    </p>
                  </div>
                  <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-200">
                    LWS France
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hôte SMTP Sortant LWS
                    </label>
                    <input
                      type="text"
                      value={smtpConfig.host}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                      placeholder="mail.lws.fr ou mail.votredomaine.com"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Par défaut : <code>mail.lws.fr</code></span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Port SMTP & Sécurité
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={smtpConfig.port}
                        onChange={(e) => {
                          const p = Number(e.target.value);
                          setSmtpConfig({
                            ...smtpConfig,
                            port: p,
                            useSsl: p === 465,
                            useTls: p === 587
                          });
                        }}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                      >
                        <option value="465">Port 465 (SSL direct - Recommandé LWS)</option>
                        <option value="587">Port 587 (STARTTLS)</option>
                        <option value="25">Port 25 (Standard sans SSL)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Adresse Email LWS (Nom d'utilisateur)
                    </label>
                    <input
                      type="email"
                      value={smtpConfig.user}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                      placeholder="contact@votredomaine.com"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Compte créé dans votre espace cPanel LWS</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mot de passe du compte LWS
                    </label>
                    <input
                      type="password"
                      value={smtpConfig.password}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Même mot de passe que sur <code>webmail.lws.fr</code></span>
                  </div>
                </div>

                {/* Tester la connexion */}
                <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-slate-500">
                    Effectue une négociation TLS/SSL réelle avec la socket du serveur LWS.
                  </div>
                  <button
                    onClick={handleTestSmtp}
                    disabled={isTestingSmtp}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 ${isTestingSmtp ? 'animate-spin' : ''}`} />
                    {isTestingSmtp ? 'Test en cours...' : 'Tester la connexion LWS SMTP'}
                  </button>
                </div>

                {/* Résultat du test */}
                {smtpTestResult && (
                  <div className={`mt-4 p-4 rounded-xl border text-sm ${
                    smtpTestResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    <div className="flex items-start gap-3">
                      {smtpTestResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold">{smtpTestResult.message}</div>
                        {smtpTestResult.details && (
                          <div className="text-xs mt-1 opacity-90">{smtpTestResult.details}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Historique des envois LWS */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-600" />
                  Journal d'audit des emails expédiés
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Destinataire</th>
                        <th className="px-4 py-2.5">Objet</th>
                        <th className="px-4 py-2.5">Serveur SMTP</th>
                        <th className="px-4 py-2.5">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {emailLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                            Aucun email encore envoyé.
                          </td>
                        </tr>
                      ) : (
                        emailLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-4 py-2.5">{new Date(log.sentAt).toLocaleString('fr-FR')}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-900">{log.recipient}</td>
                            <td className="px-4 py-2.5">{log.subject}</td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{log.smtpHost}</td>
                            <td className="px-4 py-2.5">
                              {log.status === 'SUCCESS' ? (
                                <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-semibold text-[11px]">Succès</span>
                              ) : (
                                <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded font-semibold text-[11px]">Échec</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Colonne Recommandations & DNS LWS */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-xl p-5 shadow-sm">
                <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Délivrabilité LWS (SPF & DKIM)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Pour garantir que vos bons de commande arrivent bien en boîte de réception sans être bloqués par Gmail ou Outlook :
                </p>
                <div className="space-y-3 text-xs">
                  <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                    <span className="text-blue-400 font-semibold block mb-1">1. Champ SPF (Zone DNS LWS)</span>
                    <code className="text-emerald-400 text-[11px] font-mono block bg-black/40 p-1.5 rounded">
                      v=spf1 include:spf.lws.fr ~all
                    </code>
                  </div>
                  <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                    <span className="text-blue-400 font-semibold block mb-1">2. Activation DKIM</span>
                    <span className="text-slate-300">
                      Activez DKIM en un clic dans votre cPanel LWS &rarr; "Comptes de messagerie" &rarr; "Authentification".
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm text-xs space-y-3">
                <h4 className="font-bold text-slate-900 text-sm">Aide-Mémoire LWS</h4>
                <ul className="space-y-2 text-slate-600">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>LWS limite les envois à <strong>300 emails par heure</strong> sur hébergement mutualisé pour protéger la réputation IP.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Utilisez le <strong>Port 465 SSL</strong> car les opérateurs bloquent parfois le port 25 sortant.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Accédez à vos boîtes à tout moment sur <code>webmail.lws.fr</code>.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ONGLET 4 : CONSOLE API / SWAGGER RUNNER */}
        {/* ========================================================================= */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-blue-600" />
                    Testeur d'Endpoints FastAPI & Spécification REST
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Exécutez directement les requêtes de l'API avec les en-têtes JSON et l'authentification Bearer JWT.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Docs :</span>
                  <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">/docs (Swagger)</span>
                  <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">/redoc</span>
                </div>
              </div>

              {/* Endpoint Selector */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sélectionner un endpoint à tester :</label>
                  <select
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                  >
                    <option value="orders_get">GET /api/orders &mdash; Lister tous les bons de commande</option>
                    <option value="orders_post">POST /api/orders &mdash; Créer un nouveau bon de commande</option>
                    <option value="suppliers_get">GET /api/suppliers &mdash; Lister le référentiel fournisseurs</option>
                    <option value="auth_login">POST /api/auth/login &mdash; Obtenir un jeton JWT (Connexion)</option>
                    <option value="mail_test">GET /api/mail/config-info &mdash; Consulter la configuration LWS</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleRunApiTest}
                    disabled={apiTestingLoading}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    {apiTestingLoading ? 'Exécution...' : 'Envoyer Requête'}
                  </button>
                </div>
              </div>

              {/* Payload / Response view */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Details Requête */}
                <div className="bg-slate-900 rounded-xl p-4 text-slate-200 font-mono text-xs">
                  <div className="text-slate-400 font-semibold mb-2 flex items-center justify-between">
                    <span>CURL Équivalent :</span>
                    <span className="text-[10px] text-blue-400">FastAPI Specs</span>
                  </div>
                  <pre className="overflow-x-auto text-emerald-400 p-2 bg-black/40 rounded">
{apiEndpoint === 'orders_get' && `curl -X GET "https://api.domaine.com/api/orders" \\
  -H "Authorization: Bearer <TOKEN_JWT>" \\
  -H "Accept: application/json"`}
{apiEndpoint === 'orders_post' && `curl -X POST "https://api.domaine.com/api/orders" \\
  -H "Authorization: Bearer <TOKEN_JWT>" \\
  -H "Content-Type: application/json" \\
  -d '{"supplier_id": 1, "items": [{"description": "Article", "quantity": 1, "unit_price_ht": 50}]}'`}
{apiEndpoint === 'suppliers_get' && `curl -X GET "https://api.domaine.com/api/suppliers" \\
  -H "Authorization: Bearer <TOKEN_JWT>"`}
{apiEndpoint === 'auth_login' && `curl -X POST "https://api.domaine.com/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "admin@entreprise.com", "password": "Admin1234!"}'`}
{apiEndpoint === 'mail_test' && `curl -X GET "https://api.domaine.com/api/mail/config-info" \\
  -H "Authorization: Bearer <TOKEN_JWT>"`}
                  </pre>
                </div>

                {/* Réponse JSON */}
                <div className="bg-slate-900 rounded-xl p-4 text-slate-200 font-mono text-xs">
                  <div className="text-slate-400 font-semibold mb-2 flex items-center justify-between">
                    <span>Réponse du Serveur :</span>
                    {apiResponse && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${apiResponse.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        HTTP {apiResponse.status || 'ERR'}
                      </span>
                    )}
                  </div>
                  <pre className="overflow-x-auto max-h-60 text-slate-300 p-2 bg-black/40 rounded">
                    {apiResponse ? JSON.stringify(apiResponse.data || apiResponse, null, 2) : '// Cliquez sur "Envoyer Requête" pour voir la réponse'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ONGLET 5 : CODE SOURCE FASTAPI & EXPLORATEUR */}
        {/* ========================================================================= */}
        {activeTab === 'code' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div>
                <h2 className="text-base font-bold text-slate-900">Arborescence du Projet FastAPI Python</h2>
                <p className="text-xs text-slate-500">Explorez les fichiers prêts pour le déploiement sur votre hébergement LWS.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(fileContent);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? 'Copié !' : 'Copier le fichier'}
                </button>
                <button
                  onClick={handleDownloadZip}
                  disabled={isDownloadingZip}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isDownloadingZip ? 'Téléchargement...' : 'Télécharger ZIP'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Arborescence à gauche */}
              <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm max-h-[600px] overflow-y-auto">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Fichiers Python</div>
                <div className="space-y-0.5">
                  {projectFiles.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => !f.isDir && loadFileContent(f.path)}
                      disabled={f.isDir}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono flex items-center gap-2 transition ${
                        f.isDir
                          ? 'text-slate-400 font-bold bg-slate-50/50 cursor-default'
                          : selectedFilePath === f.path
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {f.isDir ? (
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                      ) : (
                        <Code2 className="w-3 h-3 text-blue-500" />
                      )}
                      <span className="truncate">{f.path}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visionneuse de code à droite */}
              <div className="md:col-span-3 bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-sm text-slate-100 flex flex-col max-h-[600px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400 font-mono">
                  <span>📄 {selectedFilePath}</span>
                  <span className="text-[11px] text-slate-500">Python 3.10+ / FastAPI</span>
                </div>
                <pre className="flex-1 overflow-auto text-xs font-mono text-slate-300 pt-3 leading-relaxed">
                  {fileContent}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ONGLET 6 : GUIDE DE DÉPLOIEMENT LWS */}
        {/* ========================================================================= */}
        {activeTab === 'guide' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Guide d'installation sur l'hébergeur LWS</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Retrouvez ci-dessous les instructions détaillées pour déployer cette API sur votre formule LWS (cPanel mutualisé ou VPS Debian/Ubuntu).
              </p>
            </div>

            {/* Méthode 1 : cPanel mutualisé */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <span className="bg-blue-600 text-white font-bold w-7 h-7 rounded-full flex items-center justify-center text-xs">1</span>
                <h3 className="text-base font-bold text-slate-900">Sur Hébergement Mutualisé LWS (cPanel Python App)</h3>
              </div>
              <ol className="list-decimal list-inside space-y-3 text-xs sm:text-sm text-slate-700 leading-relaxed ml-2">
                <li>
                  <strong>Téléchargez l'archive :</strong> Cliquez sur le bouton <span className="text-blue-600 font-semibold">"Télécharger FastAPI (.zip)"</span> en haut à droite.
                </li>
                <li>
                  <strong>Accédez à votre cPanel LWS :</strong> Connectez-vous sur votre espace client LWS puis ouvrez <em>cPanel</em>.
                </li>
                <li>
                  <strong>Configurer l'application Python :</strong> Rendez-vous dans la rubrique <em>Logiciels</em> &rarr; <em>Setup Python App</em> (Configurer l'application Python) :
                  <ul className="list-disc list-inside ml-6 mt-1 text-slate-600 text-xs space-y-1">
                    <li>Version Python : <code>3.10</code> ou <code>3.11</code></li>
                    <li>Répertoire de l'application : <code>fastapi_commandes</code></li>
                    <li>Fichier de démarrage : <code>passenger_wsgi.py</code></li>
                    <li>Point d'entrée : <code>application</code></li>
                  </ul>
                </li>
                <li>
                  <strong>Téléversez les fichiers :</strong> Décompressez le ZIP et téléversez les fichiers dans le dossier <code>fastapi_commandes</code> via FTP ou le Gestionnaire de fichiers cPanel.
                </li>
                <li>
                  <strong>Installez les dépendances :</strong> Ouvrez le Terminal cPanel, activez le venv (commande indiquée en haut de l'interface cPanel Python) et lancez :
                  <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded font-mono text-xs mt-1 overflow-x-auto">
pip install -r requirements.txt
pip install a2wsgi
                  </pre>
                </li>
                <li>
                  <strong>Fichier de configuration :</strong> Créez le fichier <code>.env</code> avec vos identifiants LWS et cliquez sur <strong>Restart</strong>.
                </li>
              </ol>
            </div>

            {/* Méthode 2 : VPS Linux LWS */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <span className="bg-slate-800 text-white font-bold w-7 h-7 rounded-full flex items-center justify-center text-xs">2</span>
                <h3 className="text-base font-bold text-slate-900">Sur Serveur Dédié ou VPS LWS (Nginx + Systemd + Uvicorn)</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600">
                Sur un VPS LWS sous Linux (Ubuntu / Debian), vous lancez Uvicorn comme un service permanent géré par Systemd :
              </p>
              <pre className="bg-slate-900 text-emerald-400 p-3.5 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed">
# 1. Cloner ou transférer le projet
cd /var/www/fastapi-commandes
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Lancement direct de test
python run.py

# 3. Test SMTP autonome LWS
python test_lws_smtp.py contact@fournisseur-test.com
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL : VOIR DÉTAILS D'UN BON DE COMMANDE */}
      {/* ========================================================================= */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between rounded-t-2xl">
              <div>
                <span className="text-xs uppercase text-blue-400 font-bold tracking-wider">Aperçu du Bon de Commande</span>
                <h3 className="text-xl font-bold font-mono">{selectedOrder.order_number}</h3>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedOrder.status)}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-slate-400 hover:text-white ml-2 text-xl font-bold"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Fournisseur :</span>
                  <div className="font-bold text-slate-900 text-sm">{selectedOrder.supplier?.name}</div>
                  <div className="text-slate-600">{selectedOrder.supplier?.email}</div>
                  <div className="text-slate-500">{selectedOrder.supplier?.address}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Date d'émission :</span>
                  <div className="font-semibold text-slate-800">
                    {new Date(selectedOrder.order_date).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="mt-1">
                    <span className="text-slate-400">Règlement :</span> {selectedOrder.payment_terms || '30 jours'}
                  </div>
                  {selectedOrder.expected_delivery_date && (
                    <div className="text-blue-600 font-medium">
                      Livraison prévue : {new Date(selectedOrder.expected_delivery_date).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                </div>
              </div>

              {/* Lignes d'articles */}
              <div>
                <h4 className="font-bold text-xs uppercase text-slate-500 mb-2">Articles commandés</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="p-3">Désignation</th>
                        <th className="p-3 text-right">Qté</th>
                        <th className="p-3 text-right">P.U. HT</th>
                        <th className="p-3 text-right">TVA</th>
                        <th className="p-3 text-right">Total HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-3">
                            <div className="font-semibold text-slate-800">{item.description}</div>
                            {item.reference && <div className="text-[11px] font-mono text-slate-400">Réf : {item.reference}</div>}
                          </td>
                          <td className="p-3 text-right font-medium">{item.quantity}</td>
                          <td className="p-3 text-right font-mono">{item.unit_price_ht.toFixed(2)} €</td>
                          <td className="p-3 text-right">{item.tva_rate}%</td>
                          <td className="p-3 text-right font-mono font-semibold">
                            {(item.total_ht || item.quantity * item.unit_price_ht).toFixed(2)} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totaux */}
              <div className="flex justify-end">
                <div className="w-64 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Total HT :</span>
                    <span className="font-mono font-semibold">{selectedOrder.total_ht.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total TVA :</span>
                    <span className="font-mono font-semibold">{selectedOrder.total_tva.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t border-slate-200">
                    <span>Total Net TTC :</span>
                    <span className="font-mono text-blue-600">{selectedOrder.total_ttc.toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              {/* Actions de changement de statut */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Changer statut :</span>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => handleUpdateStatus(selectedOrder.id, e.target.value)}
                    className="border border-slate-200 rounded px-2 py-1 text-xs font-semibold bg-white"
                  >
                    <option value="BROUILLON">Brouillon</option>
                    <option value="VALIDE">Validé</option>
                    <option value="ENVOYE">Envoyé LWS</option>
                    <option value="RECEPTIONNE">Réceptionné</option>
                    <option value="ANNULE">Annulé</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setOrderToSend(selectedOrder);
                      setRecipientOverride(selectedOrder.supplier?.email || '');
                      setIsSendEmailOpen(true);
                      setSelectedOrder(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Expédier au Fournisseur par Email LWS
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : ENVOYER LE BON DE COMMANDE PAR EMAIL LWS */}
      {/* ========================================================================= */}
      {isSendEmailOpen && orderToSend && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-600" />
                  Expédition du Bon {orderToSend.order_number}
                </h3>
                <p className="text-xs text-slate-500">Via le relais SMTP LWS ({smtpConfig.host}:{smtpConfig.port})</p>
              </div>
              <button onClick={() => setIsSendEmailOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">
                &times;
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse email du destinataire (Fournisseur) :
              </label>
              <input
                type="email"
                value={recipientOverride}
                onChange={(e) => setRecipientOverride(e.target.value)}
                placeholder="contact@fournisseur.com"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Message personnalisé d'accompagnement :
              </label>
              <textarea
                rows={3}
                value={customEmailMessage}
                onChange={(e) => setCustomEmailMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Le courriel sera généré au format HTML haute définition avec tableau des lignes, montants HT/TTC et signature de l'entreprise.
              </span>
            </div>

            {emailAlert && (
              <div className={`p-3 rounded-lg text-xs font-semibold ${
                emailAlert.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {emailAlert.message}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSendEmailOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSendingEmail}
                onClick={handleSendOrderEmail}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                <Send className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-bounce' : ''}`} />
                {isSendingEmail ? 'Envoi LWS en cours...' : 'Confirmer et Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : CRÉER UN NOUVEAU BON DE COMMANDE */}
      {/* ========================================================================= */}
      {isCreateOrderOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Créer un Bon de Commande
              </h3>
              <button onClick={() => setIsCreateOrderOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fournisseur :</label>
                  <select
                    value={newOrderSupplierId}
                    onChange={(e) => setNewOrderSupplierId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date de livraison souhaitée :</label>
                  <input
                    type="date"
                    value={newOrderDeliveryDate}
                    onChange={(e) => setNewOrderDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Lignes d'articles dynamiques */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase text-slate-500">Lignes de commande</label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewOrderItems([
                        ...newOrderItems,
                        { reference: '', description: '', quantity: 1, unit_price_ht: 0, tva_rate: 20 }
                      ])
                    }
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                  </button>
                </div>

                <div className="space-y-2">
                  {newOrderItems.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        placeholder="Réf."
                        value={item.reference}
                        onChange={(e) => {
                          const updated = [...newOrderItems];
                          updated[idx].reference = e.target.value;
                          setNewOrderItems(updated);
                        }}
                        className="w-full sm:w-24 px-2 py-1 text-xs border border-slate-200 rounded bg-white font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Désignation de l'article"
                        required
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...newOrderItems];
                          updated[idx].description = e.target.value;
                          setNewOrderItems(updated);
                        }}
                        className="w-full sm:flex-1 px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                      />
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Qté"
                        required
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...newOrderItems];
                          updated[idx].quantity = Number(e.target.value);
                          setNewOrderItems(updated);
                        }}
                        className="w-full sm:w-16 px-2 py-1 text-xs border border-slate-200 rounded bg-white text-right"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="P.U. HT"
                        required
                        value={item.unit_price_ht}
                        onChange={(e) => {
                          const updated = [...newOrderItems];
                          updated[idx].unit_price_ht = Number(e.target.value);
                          setNewOrderItems(updated);
                        }}
                        className="w-full sm:w-24 px-2 py-1 text-xs border border-slate-200 rounded bg-white text-right font-mono"
                      />
                      <select
                        value={item.tva_rate}
                        onChange={(e) => {
                          const updated = [...newOrderItems];
                          updated[idx].tva_rate = Number(e.target.value);
                          setNewOrderItems(updated);
                        }}
                        className="w-full sm:w-20 px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                      >
                        <option value="20">20%</option>
                        <option value="10">10%</option>
                        <option value="5.5">5.5%</option>
                        <option value="0">0%</option>
                      </select>
                      {newOrderItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewOrderItems(newOrderItems.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Instructions / Remarques :</label>
                <textarea
                  rows={2}
                  value={newOrderNotes}
                  onChange={(e) => setNewOrderNotes(e.target.value)}
                  placeholder="Consignes de livraison, horaires d'accès..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOrderOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Enregistrer le Bon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : AJOUTER UN FOURNISSEUR */}
      {/* ========================================================================= */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Nouveau Fournisseur
              </h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Raison Sociale :</label>
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Ex : Acme Fournitures SAS"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Destinataire (pour envois LWS) :</label>
                <input
                  type="email"
                  required
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  placeholder="commandes@acme.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Référent :</label>
                  <input
                    type="text"
                    value={newSupplierContact}
                    onChange={(e) => setNewSupplierContact(e.target.value)}
                    placeholder="M. Martin"
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone :</label>
                  <input
                    type="text"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    placeholder="01 23 45 67 89"
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Conditions de règlement :</label>
                <input
                  type="text"
                  value={newSupplierPaymentTerms}
                  onChange={(e) => setNewSupplierPaymentTerms(e.target.value)}
                  placeholder="30 jours net"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Adresse postale :</label>
                <textarea
                  rows={2}
                  value={newSupplierAddress}
                  onChange={(e) => setNewSupplierAddress(e.target.value)}
                  placeholder="Rue, Ville, Code Postal"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Créer le Fournisseur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

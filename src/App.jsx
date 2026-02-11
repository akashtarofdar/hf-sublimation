import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp, 
  query,
  increment,
  where
} from 'firebase/firestore';
import { 
  Upload, Search, X, Image as ImageIcon, Loader2, Maximize2, Lock, Unlock, 
  Trash2, LogIn, LogOut, Download, Palette, Filter, Pencil, CloudUpload, 
  Settings, AlertCircle, LayoutDashboard, Bell, BarChart3, Users, ImagePlus, ShieldCheck, Eye, CheckCircle, XCircle,
  ArrowDownUp // Added Icon for Sorting
} from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyB7ubsi_hAiwJy4X-wYcA8YtoG2ERPAJwI",
  authDomain: "hf-sublimation.firebaseapp.com",
  projectId: "hf-sublimation",
  storageBucket: "hf-sublimation.firebasestorage.app",
  messagingSenderId: "92108127949",
  appId: "1:92108127949:web:b8191c9bf1c015e8fa7384",
  measurementId: "G-F0N2TFY5WY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper Data
const COLORS = [
  { name: 'Red', hex: '#ef4444' }, { name: 'Blue', hex: '#3b82f6' }, { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#eab308' }, { name: 'Black', hex: '#1e293b' }, { name: 'White', hex: '#f8fafc' },
  { name: 'Purple', hex: '#a855f7' }, { name: 'Orange', hex: '#f97316' }, { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Multicolor', hex: 'linear-gradient(to right, #ef4444, #3b82f6, #22c55e)' }
];

// Image Compression Helper
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; 
        const scaleSize = MAX_WIDTH / img.width;
        const finalWidth = Math.min(img.width, MAX_WIDTH);
        const finalHeight = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.7));
      };
    };
  });
};

export default function App() {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState(null);
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Roles & Auth
  const [isDesigner, setIsDesigner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginType, setLoginType] = useState('designer'); 
  
  // Inputs
  const [loginInput, setLoginInput] = useState({ user: '', pass: '' });
  const [config, setConfig] = useState({
    designerPass: '252746',
    adminUser: 'akashumu',
    adminPass: '627425274',
    headerImage: '',
    totalViews: 0
  });

  // Modals & Features
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteRequestOpen, setIsDeleteRequestOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); 
  const [deleteReason, setDeleteReason] = useState('');
  const [targetDesign, setTargetDesign] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColorFilter, setSelectedColorFilter] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortOption, setSortOption] = useState('newest'); // FEATURE 5: Sorting State

  // Pagination (FEATURE 4)
  const [visibleCount, setVisibleCount] = useState(30);

  // Form Data (Unified State)
  const [newDesignTitle, setNewDesignTitle] = useState('');
  const [newDesignTag, setNewDesignTag] = useState('Sublimation');
  const [newDesignColor, setNewDesignColor] = useState('Multicolor');
  const [sourceLink, setSourceLink] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  
  // Settings State
  const [googleScriptUrl, setGoogleScriptUrl] = useState('');
  const [tempScriptUrl, setTempScriptUrl] = useState('');
  
  // Source File Upload State
  const [sourceFile, setSourceFile] = useState(null);
  const [useFileUpload, setUseFileUpload] = useState(false);

  // Upload Queue System (For Background Uploads)
  const [activeUploads, setActiveUploads] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // --- EFFECTS ---

  // 1. Auth & Initial Load
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 2. Fetch Designs
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'designs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort initially by date desc
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setDesigns(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Fetch Config & Increment Views
  useEffect(() => {
    if (!user) return;
    const configRef = doc(db, 'settings', 'config');
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(prev => ({ ...prev, ...data }));
        const url = data.scriptUrl || "";
        setGoogleScriptUrl(url);
        setTempScriptUrl(url);
      } else {
        setDoc(configRef, config, { merge: true });
      }
    });

    const viewed = sessionStorage.getItem('viewed');
    if (!viewed) {
      updateDoc(configRef, { totalViews: increment(1) }).catch(() => {});
      sessionStorage.setItem('viewed', 'true');
    }

    return () => unsubConfig();
  }, [user]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, selectedColorFilter, selectedCategory, sortOption]);

  // --- COMPUTED DATA ---
  const categories = useMemo(() => {
    const cats = new Set(['Sublimation', 'Full Sleeve', 'Collar', 'Half Sleeve']);
    designs.forEach(d => d.tag && cats.add(d.tag));
    return Array.from(cats).sort();
  }, [designs]);

  // FEATURE 5: Advanced Sorting Logic
  const filteredDesigns = useMemo(() => {
    let result = designs.filter(d => {
      const matchesSearch = d.title?.toLowerCase().includes(searchQuery.toLowerCase()) || d.tag?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesColor = selectedColorFilter === 'All' || d.color === selectedColorFilter;
      const matchesCategory = selectedCategory === 'All' || d.tag === selectedCategory;
      return matchesSearch && matchesColor && matchesCategory;
    });

    // Sorting Logic
    if (sortOption === 'newest') {
      result.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } else if (sortOption === 'oldest') {
      result.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    } else if (sortOption === 'popular') {
      result.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    } else if (sortOption === 'name') {
      result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    return result;
  }, [designs, searchQuery, selectedColorFilter, selectedCategory, sortOption]);

  // FEATURE 4: Pagination Slice
  const displayedDesigns = useMemo(() => {
    return filteredDesigns.slice(0, visibleCount);
  }, [filteredDesigns, visibleCount]);

  const categoryStats = useMemo(() => {
    const stats = {};
    designs.forEach(d => {
      stats[d.tag] = (stats[d.tag] || 0) + 1;
    });
    return stats;
  }, [designs]);

  // --- ACTIONS ---

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginType === 'admin') {
      if (loginInput.user === config.adminUser && loginInput.pass === config.adminPass) {
        setIsAdmin(true);
        setIsDesigner(true);
        setShowAdminPanel(true);
        setShowLoginModal(false);
      } else {
        alert("ভুল ইউজারনেম বা পাসওয়ার্ড!");
      }
    } else {
      if (loginInput.pass === config.designerPass) {
        setIsDesigner(true);
        setShowLoginModal(false);
      } else {
        alert("ভুল পাসওয়ার্ড!");
      }
    }
    setLoginInput({ user: '', pass: '' });
  };

  const handleLogout = () => {
    setIsDesigner(false);
    setIsAdmin(false);
    setShowAdminPanel(false);
  };

  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, "settings", "config"), { scriptUrl: tempScriptUrl }, { merge: true });
      setGoogleScriptUrl(tempScriptUrl);
      setIsSettingsModalOpen(false);
      alert("গুগল ড্রাইভ লিঙ্ক আপডেট হয়েছে!");
    } catch (err) {
      console.error("Settings Save Error:", err);
      alert("সেভ করা সম্ভব হয়নি।");
    }
  };

  const uploadToTelegram = async (file) => {
    const data = new FormData();
    data.append("file", file);
    try {
      const res = await fetch("https://private-link-sender.onrender.com/upload", { method: "POST", body: data });
      const json = await res.json();
      if (json.success) return json.link;
      throw new Error("Upload Failed");
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  // --- EDIT HANDLERS ---
  const [editingDesign, setEditingDesign] = useState(null);

  const openEditModal = (e, design) => {
    e.stopPropagation();
    setEditingDesign(design);
    setNewDesignTitle(design.title || '');
    setNewDesignTag(design.tag || 'Sublimation');
    setNewDesignColor(design.color || 'Multicolor');
    setSourceLink(design.sourceLink || '');
    setFileToUpload(null);
    setPreviewUrl(null);
    setSourceFile(null);
    setUseFileUpload(false);
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingDesign) return;
    
    const uploadId = Date.now();
    const newItem = { id: uploadId, title: `Update: ${newDesignTitle}`, status: 'শুরু হচ্ছে...', type: 'update' };
    setActiveUploads(prev => [...prev, newItem]);

    const updateData = {
      id: editingDesign.id,
      title: newDesignTitle,
      tag: newDesignTag,
      color: newDesignColor,
      sourceLink: sourceLink,
      useFile: useFileUpload,
      file: sourceFile
    };

    setIsEditModalOpen(false);
    setEditingDesign(null);
    resetForm();

    (async () => {
      const updateStatus = (status, isError = false) => {
        setActiveUploads(prev => prev.map(item => item.id === uploadId ? { ...item, status, isError, isComplete: !isError && status === 'সম্পন্ন!' } : item));
      };

      try {
        const updates = {
          title: updateData.title,
          tag: updateData.tag,
          color: updateData.color,
          sourceLink: updateData.sourceLink
        };
        
        if (updateData.useFile && updateData.file) {
           updateStatus('সোর্স ফাইল আপলোড হচ্ছে...');
           updates.sourceLink = await uploadToTelegram(updateData.file);
        }

        updateStatus('ডাটাবেস আপডেট হচ্ছে...');
        await updateDoc(doc(db, 'designs', updateData.id), updates);
        
        updateStatus('সম্পন্ন!');
        setTimeout(() => removeUploadItem(uploadId), 3000);
      } catch (err) {
        console.error("Update Error:", err);
        updateStatus('ব্যর্থ: ' + err.message, true);
      }
    })();
  };

  const handleUpload = async () => {
    if (!fileToUpload || !newDesignTitle) return alert("নাম এবং ছবি দিন!");
    
    const uploadId = Date.now();
    const newItem = { id: uploadId, title: newDesignTitle, status: 'শুরু হচ্ছে...', type: 'upload' };
    setActiveUploads(prev => [...prev, newItem]);

    const uploadData = {
      title: newDesignTitle,
      tag: newDesignTag,
      color: newDesignColor,
      sourceLink: sourceLink,
      useFile: useFileUpload,
      sourceFileObj: sourceFile,
      previewFileObj: fileToUpload,
      uid: user.uid
    };

    setIsUploadModalOpen(false);
    resetForm();

    (async () => {
      const updateStatus = (status, isError = false) => {
        setActiveUploads(prev => prev.map(item => item.id === uploadId ? { ...item, status, isError, isComplete: !isError && status === 'সম্পন্ন!' } : item));
      };

      try {
        let link = uploadData.sourceLink;
        if (uploadData.useFile && uploadData.sourceFileObj) {
          updateStatus('সোর্স ফাইল আপলোড হচ্ছে...');
          link = await uploadToTelegram(uploadData.sourceFileObj);
        }

        updateStatus('প্রিভিউ প্রসেসিং...');
        const imgBase64 = await compressImage(uploadData.previewFileObj); 

        updateStatus('ডাটাবেসে সেভ হচ্ছে...');
        await addDoc(collection(db, 'designs'), {
          title: uploadData.title,
          tag: uploadData.tag,
          color: uploadData.color,
          imageData: imgBase64,
          sourceLink: link,
          uploaderId: uploadData.uid,
          downloads: 0,
          createdAt: serverTimestamp()
        });
        
        updateStatus('সম্পন্ন!');
        setTimeout(() => removeUploadItem(uploadId), 3000);

      } catch (err) {
        updateStatus('ব্যর্থ: ' + err.message, true);
      }
    })();
  };

  const removeUploadItem = (id) => {
    setActiveUploads(prev => prev.filter(item => item.id !== id));
  };

  const resetForm = () => {
    setFileToUpload(null);
    setPreviewUrl(null);
    setNewDesignTitle('');
    setNewDesignTag('Sublimation');
    setNewDesignColor('Multicolor');
    setSourceLink('');
    setSourceFile(null);
    setUseFileUpload(false);
  };

  const submitDeleteRequest = async () => {
    if (!deleteReason) return alert("কারণ লিখতে হবে!");
    try {
      await addDoc(collection(db, 'deleteRequests'), {
        designId: targetDesign.id,
        designTitle: targetDesign.title,
        imageData: targetDesign.imageData,
        reason: deleteReason,
        requestedBy: user.uid,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      alert("ডিলিট রিকোয়েস্ট অ্যাডমিনের কাছে পাঠানো হয়েছে।");
      setIsDeleteRequestOpen(false);
      setDeleteReason('');
    } catch (err) {
      alert("রিকোয়েস্ট ফেইলড!");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setFileToUpload(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSourceFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSourceFile(file);
    }
  };

  const openSourceLink = (id, link) => {
    window.open(link, '_blank');
    updateDoc(doc(db, 'designs', id), {
      downloads: increment(1)
    }).catch(e => console.log("Popularity update failed", e));
  };

  const downloadImage = (e, id, img, title) => {
    e.stopPropagation();
    
    updateDoc(doc(db, 'designs', id), {
      downloads: increment(1)
    }).catch(e => console.log("Popularity update failed", e));

    const image = new Image();
    image.src = img;
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const fontSize = Math.max(24, Math.floor(image.width * 0.04));
      canvas.width = image.width;
      canvas.height = image.height + fontSize + 20;
      ctx.drawImage(image, 0, 0);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, image.height, canvas.width, canvas.height);
      ctx.fillStyle = '#000';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(title || 'HF Sublimation', canvas.width / 2, image.height + fontSize);
      const link = document.createElement('a');
      link.download = `${title}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    };
  };

  // --- ADMIN PANEL COMPONENT ---
  const AdminPanel = () => {
    const [requests, setRequests] = useState([]);
    const [view, setView] = useState('dashboard');
    const [newSettings, setNewSettings] = useState({ ...config });

    useEffect(() => {
      setNewSettings({ ...config });
    }, [config]);

    useEffect(() => {
      const q = query(collection(db, 'deleteRequests'));
      return onSnapshot(q, (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }, []);

    const processRequest = async (req, action) => {
      if (action === 'approve') {
        await deleteDoc(doc(db, 'designs', req.designId));
        await deleteDoc(doc(db, 'deleteRequests', req.id));
        alert("ডিজাইন ডিলিট করা হয়েছে!");
      } else {
        await deleteDoc(doc(db, 'deleteRequests', req.id));
        alert("রিকোয়েস্ট বাতিল করা হয়েছে।");
      }
    };

    const saveAdminSettings = async () => {
      await updateDoc(doc(db, 'settings', 'config'), newSettings);
      alert("সেটিংস সেভ হয়েছে!");
    };

    return (
      <div className="fixed inset-0 z-[100] bg-slate-100 overflow-auto font-sans">
        <div className="flex h-screen">
          {/* Sidebar */}
          <div className="w-64 bg-slate-900 text-white p-6 flex flex-col">
            <h2 className="text-2xl font-bold mb-8 text-indigo-400">Admin Panel</h2>
            <nav className="space-y-4 flex-1">
              <button onClick={() => setView('dashboard')} className={`w-full text-left p-3 rounded hover:bg-slate-800 ${view==='dashboard'?'bg-indigo-600':''}`}><LayoutDashboard className="inline mr-2" size={18}/> Dashboard</button>
              <button onClick={() => setView('requests')} className={`w-full text-left p-3 rounded hover:bg-slate-800 ${view==='requests'?'bg-indigo-600':''}`}>
                <Bell className="inline mr-2" size={18}/> Requests 
                {requests.length > 0 && <span className="bg-red-500 text-xs px-2 py-1 rounded-full ml-2">{requests.length}</span>}
              </button>
              <button onClick={() => setView('settings')} className={`w-full text-left p-3 rounded hover:bg-slate-800 ${view==='settings'?'bg-indigo-600':''}`}><Settings className="inline mr-2" size={18}/> Settings</button>
            </nav>
            <button onClick={() => setShowAdminPanel(false)} className="bg-slate-800 p-3 rounded text-center hover:bg-red-600 transition">Back to Site</button>
          </div>

          {/* Content */}
          <div className="flex-1 p-8 overflow-y-auto">
            {view === 'dashboard' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-800">ওভারভিউ</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="bg-blue-100 p-4 rounded-full text-blue-600"><ImagePlus size={32}/></div>
                    <div><p className="text-slate-500">মোট ডিজাইন</p><h3 className="text-2xl font-bold">{designs.length}</h3></div>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="bg-green-100 p-4 rounded-full text-green-600"><Eye size={32}/></div>
                    <div><p className="text-slate-500">মোট ভিউস</p><h3 className="text-2xl font-bold">{config.totalViews}</h3></div>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="bg-orange-100 p-4 rounded-full text-orange-600"><BarChart3 size={32}/></div>
                    <div><p className="text-slate-500">ক্যাটাগরি</p><h3 className="text-2xl font-bold">{Object.keys(categoryStats).length}</h3></div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold mb-4">ক্যাটাগরি অনুযায়ী আপলোড</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(categoryStats).map(([cat, count]) => (
                      <div key={cat} className="p-3 bg-slate-50 rounded border border-slate-100 flex justify-between">
                        <span className="font-medium text-slate-600">{cat}</span>
                        <span className="font-bold text-indigo-600">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === 'requests' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-slate-800">ডিলিট রিকোয়েস্ট ({requests.length})</h2>
                {requests.length === 0 ? <p className="text-slate-500">কোনো রিকোয়েস্ট নেই।</p> : (
                  <div className="space-y-4">
                    {requests.map(req => (
                      <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-4 items-center">
                        <img src={req.imageData} className="w-16 h-16 object-contain rounded bg-slate-50" />
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800">{req.designTitle}</h4>
                          <p className="text-sm text-red-500 font-medium">কারণ: {req.reason}</p>
                          <p className="text-xs text-slate-400">{req.timestamp?.toDate().toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => processRequest(req, 'reject')} className="px-4 py-2 bg-slate-200 rounded font-bold text-slate-700 hover:bg-slate-300">বাতিল</button>
                          <button onClick={() => processRequest(req, 'approve')} className="px-4 py-2 bg-red-500 rounded font-bold text-white hover:bg-red-600">ডিলিট করুন</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === 'settings' && (
              <div className="max-w-xl bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><ShieldCheck className="text-indigo-600"/> সিকিউরিটি সেটিংস</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-1">ডিজাইনার পাসওয়ার্ড</label>
                    <input type="text" className="w-full p-2 border rounded" value={newSettings.designerPass || ''} onChange={e => setNewSettings({...newSettings, designerPass: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-1">অ্যাডমিন ইউজারনেম</label>
                    <input type="text" className="w-full p-2 border rounded" value={newSettings.adminUser || ''} onChange={e => setNewSettings({...newSettings, adminUser: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-1">অ্যাডমিন পাসওয়ার্ড</label>
                    <input type="text" className="w-full p-2 border rounded" value={newSettings.adminPass || ''} onChange={e => setNewSettings({...newSettings, adminPass: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-1">হেডার ব্যানার ইমেজ (URL)</label>
                    <input type="text" className="w-full p-2 border rounded" value={newSettings.headerImage || ''} onChange={e => setNewSettings({...newSettings, headerImage: e.target.value})} placeholder="https://..." />
                  </div>
                  <button onClick={saveAdminSettings} className="w-full bg-indigo-600 text-white py-3 rounded font-bold mt-4 hover:bg-indigo-700">আপডেট সেভ করুন</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- MAIN RENDER ---
  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;
  if (showAdminPanel && isAdmin) return <AdminPanel />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-5 flex flex-col items-center gap-4">
          
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => {window.scrollTo(0, 0); setSelectedCategory('All'); setSelectedColorFilter('All');}}>
                <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200">
                    <ImageIcon size={24} />
                </div>
                <div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 hidden sm:block">
                    HF Sublimation
                    </h1>
                    <h1 className="text-xl font-bold text-indigo-700 sm:hidden">HF</h1>
                </div>
                </div>
            </div>

            <div className="flex-1 max-w-md mx-4 relative group">
                <Search className="absolute left-4 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input 
                type="text" 
                placeholder="ডিজাইন খুঁজুন..." 
                className="w-full pl-11 pr-4 py-2.5 bg-slate-100 border-none rounded-full focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all shadow-inner outline-none text-sm font-medium"
                value={searchQuery || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="flex items-center gap-2">
                {isDesigner ? (
                <>
                    {isAdmin && <button onClick={() => setShowAdminPanel(true)} className="bg-slate-800 text-white p-2 rounded-full" title="Admin Panel"><LayoutDashboard size={18}/></button>}
                    <button 
                      onClick={() => setIsSettingsModalOpen(true)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2.5 rounded-full border border-slate-200 transition-colors"
                      title="সেটিংস"
                    >
                      <Settings size={18} />
                    </button>
                    <button 
                      onClick={() => { resetForm(); setIsUploadModalOpen(true); }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 sm:px-5 sm:py-2.5 rounded-full sm:rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-200"
                      title="আপলোড"
                    >
                      <Upload size={18} /> <span className="hidden sm:inline">আপলোড</span>
                    </button>
                    <button onClick={handleLogout} className="bg-red-50 text-red-500 p-2.5 rounded-full border border-red-100"><LogOut size={18}/></button>
                </>
                ) : (
                <button 
                    onClick={() => setShowLoginModal(true)} 
                    className="bg-slate-800 hover:bg-slate-900 text-white p-2.5 sm:px-5 sm:py-2.5 rounded-full sm:rounded-xl flex items-center gap-2 shadow-md"
                >
                    <LogIn size={18} /> <span className="hidden sm:inline">লগইন</span>
                </button>
                )}
            </div>
          </div>

          {/* Filters Row */}
          <div className="w-full overflow-x-auto pb-1 no-scrollbar flex items-center gap-4">
            
            {/* FEATURE 5: Sorting Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
               <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><ArrowDownUp size={12}/> সর্টিং:</span>
               <select 
                 className="px-3 py-1.5 rounded-full text-xs font-bold border outline-none bg-white text-slate-600 cursor-pointer hover:border-slate-300"
                 value={sortOption} 
                 onChange={(e) => setSortOption(e.target.value)}
               >
                  <option value="newest">নতুন</option>
                  <option value="oldest">পুরাতন</option>
                  <option value="popular">জনপ্রিয়</option>
                  <option value="name">নাম (A-Z)</option>
               </select>
            </div>

            {/* Color Filter */}
            <div className="flex items-center gap-2 shrink-0 border-l pl-4 border-slate-200">
                <span className="text-xs font-bold text-slate-400 uppercase"><Filter size={12} className="inline"/> কালার:</span>
                <div className="flex gap-2">
                    <button onClick={() => setSelectedColorFilter('All')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all shrink-0 ${selectedColorFilter === 'All' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>All</button>
                    {COLORS.map((c) => (
                    <button
                        key={c.name}
                        onClick={() => setSelectedColorFilter(c.name)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 transition-all shrink-0 ${
                        selectedColorFilter === c.name 
                            ? 'bg-white text-slate-800 border-indigo-500 ring-1 ring-indigo-500 shadow-sm' 
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: c.hex }}></span>
                        {c.name}
                    </button>
                    ))}
                </div>
            </div>

            {/* Category Filter (Designer Only) */}
            {isDesigner && (
              <div className="flex items-center gap-2 shrink-0 border-l pl-4 border-slate-200">
                <span className="text-xs font-bold text-indigo-500 uppercase">ক্যাটাগরি:</span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedCategory('All')} className={`px-3 py-1 rounded-full text-xs font-bold border ${selectedCategory==='All'?'bg-indigo-600 text-white':'bg-white text-slate-600'}`}>All</button>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1 rounded-full text-xs font-bold border ${selectedCategory===cat?'bg-indigo-100 text-indigo-700 border-indigo-200':'bg-white text-slate-500'}`}>{cat}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* UPLOAD QUEUE DISPLAY */}
      {activeUploads.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 max-w-sm w-full">
          {activeUploads.map(item => (
            <div key={item.id} className={`bg-white p-3 rounded-lg shadow-xl border flex items-center justify-between gap-3 animate-in slide-in-from-right fade-in duration-300 ${item.isComplete ? 'border-green-500 bg-green-50' : item.isError ? 'border-red-500 bg-red-50' : 'border-indigo-100'}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                {item.isComplete ? <CheckCircle className="text-green-600 shrink-0" size={20}/> : 
                 item.isError ? <XCircle className="text-red-600 shrink-0" size={20}/> :
                 <Loader2 className="animate-spin text-indigo-600 shrink-0" size={20}/>}
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-slate-700 truncate">{item.title}</p>
                  <p className={`text-xs ${item.isComplete ? 'text-green-600' : item.isError ? 'text-red-500' : 'text-slate-500'}`}>{item.status}</p>
                </div>
              </div>
              <button onClick={() => removeUploadItem(item.id)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
            </div>
          ))}
        </div>
      )}

      {/* --- MAIN GRID --- */}
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {displayedDesigns.length === 0 ? (
          <div className="text-center py-20 text-slate-400">কোনো ডিজাইন পাওয়া যায়নি</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {displayedDesigns.map(design => (
                <div 
                  key={design.id} 
                  className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden group transition-all duration-300 hover:-translate-y-1 flex flex-col"
                >
                  
                  {/* Image Area */}
                  <div 
                     className="relative w-full aspect-[4/5] bg-slate-50 overflow-hidden cursor-pointer border-b border-slate-50"
                     onClick={() => setSelectedImage(design)}
                  >
                    <img 
                      src={design.imageData} 
                      alt={design.title} 
                      className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105" 
                    />
                    
                    {/* Tag & Color Dot */}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                        <span className="text-[10px] bg-white/90 backdrop-blur text-indigo-600 px-2.5 py-1 rounded-md shadow-sm font-bold tracking-wide uppercase border border-indigo-50">
                          {design.tag}
                        </span>
                        {design.color && (
                           <div 
                             className="w-4 h-4 rounded-full border border-white shadow-sm" 
                             style={{ background: COLORS.find(c => c.name === design.color)?.hex || design.color }}
                             title={design.color}
                           ></div>
                        )}
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <div className="bg-white/90 backdrop-blur text-slate-800 px-4 py-2 rounded-full shadow-lg font-medium text-sm transform translate-y-2 group-hover:translate-y-0 transition-transform">
                          ক্লিক করে দেখুন
                       </div>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-4">
                       <h3 className="font-bold text-slate-700 text-base leading-tight line-clamp-2" title={design.title}>{design.title}</h3>
                       
                       {isDesigner && (
                         <div className="flex gap-1 -mt-1 -mr-2">
                          <button 
                             onClick={(e) => openEditModal(e, design)} 
                             className="text-slate-300 hover:text-indigo-500 transition-colors p-1"
                             title="এডিট করুন"
                          >
                             <Pencil size={16} />
                          </button>
                          <button 
                             onClick={(e) => { e.stopPropagation(); setTargetDesign(design); setIsDeleteRequestOpen(true); }} 
                             className="text-slate-300 hover:text-red-500 transition-colors p-1"
                             title="ডিলিট করুন"
                          >
                             <Trash2 size={16} />
                          </button>
                         </div>
                       )}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <button 
                        onClick={(e) => downloadImage(e, design.id, design.imageData, design.title)}
                        className="bg-slate-50 text-slate-600 border border-slate-200 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-100 hover:text-indigo-600 hover:border-indigo-100 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Download size={14} /> ছবি সেভ
                      </button>

                      {isDesigner && (
                        <button 
                          onClick={() => openSourceLink(design.id, design.sourceLink)}
                          className="py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-white shadow-sm bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                        >
                          <Unlock size={14} />
                          AI ফাইল
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* FEATURE 4: Load More Button */}
            {visibleCount < filteredDesigns.length && (
              <div className="mt-10 text-center">
                <button 
                  onClick={() => setVisibleCount(prev => prev + 30)}
                  className="bg-white border border-slate-300 text-slate-600 px-8 py-3 rounded-full font-bold hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition-all"
                >
                  আরও ডিজাইন দেখুন ({filteredDesigns.length - visibleCount} টি বাকি)
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* --- MODALS --- */}

      {/* LOGIN */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-8 rounded-2xl w-full max-w-sm relative">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-4 text-center">লগইন করুন</h2>
            <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
              <button onClick={() => setLoginType('designer')} className={`flex-1 py-2 text-sm font-bold rounded-md ${loginType==='designer'?'bg-white shadow text-indigo-600':'text-slate-500'}`}>ডিজাইনার</button>
              <button onClick={() => setLoginType('admin')} className={`flex-1 py-2 text-sm font-bold rounded-md ${loginType==='admin'?'bg-white shadow text-indigo-600':'text-slate-500'}`}>অ্যাডমিন</button>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              {loginType === 'admin' && (
                <input type="text" placeholder="ইউজারনেম" className="w-full p-3 border rounded-lg" value={loginInput.user || ''} onChange={e => setLoginInput({...loginInput, user: e.target.value})} />
              )}
              <input type="password" placeholder="পাসওয়ার্ড" className="w-full p-3 border rounded-lg" value={loginInput.pass || ''} onChange={e => setLoginInput({...loginInput, pass: e.target.value})} />
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold">লগইন</button>
            </form>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md overflow-hidden relative z-10 shadow-2xl animate-[fadeIn_0.3s_ease-out]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                 <Settings size={20} className="text-slate-600"/> সেটিংস
              </h2>
              <button className="bg-slate-100 p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors" onClick={() => setIsSettingsModalOpen(false)}>
                 <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-2 block">গুগল ড্রাইভ স্ক্রিপ্ট URL</label>
                  <p className="text-xs text-slate-400 mb-2">ফাইল অটো-আপলোডের জন্য আপনার Google Apps Script এর Web App URL টি এখানে দিন।</p>
                  <textarea 
                     rows={4}
                     className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-mono text-slate-600 break-all"
                     value={tempScriptUrl || ''}
                     onChange={(e) => setTempScriptUrl(e.target.value)}
                     placeholder="https://script.google.com/macros/s/..."
                  />
               </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button onClick={() => setIsSettingsModalOpen(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-white font-bold transition-colors">বাতিল</button>
              <button onClick={handleSaveSettings} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">
                সেভ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD / EDIT */}
      {(isUploadModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg h-[90vh] overflow-y-auto relative">
            <h2 className="text-lg font-bold mb-4">{isEditModalOpen ? 'এডিট ডিজাইন' : 'নতুন আপলোড'}</h2>
            <div className="space-y-4">
              {/* Image Input (Only for upload) */}
              {isUploadModalOpen && (
                <div className="border-2 border-dashed rounded-xl p-4 text-center relative">
                  <input type="file" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer"/>
                  {previewUrl ? (
                    <img src={previewUrl} className="h-32 mx-auto object-contain" />
                  ) : <div className="py-8 text-slate-400"><CloudUpload className="mx-auto mb-2"/> ছবি দিন</div>}
                </div>
              )}

              <input type="text" placeholder="ডিজাইনের নাম" className="w-full p-3 border rounded-lg" value={newDesignTitle || ''} onChange={e => setNewDesignTitle(e.target.value)} />
              
              {/* Category Input with Suggestions */}
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">ক্যাটাগরি (লিখুন বা সিলেক্ট করুন)</label>
                <input list="cat-suggestions" type="text" className="w-full p-3 border rounded-lg" value={newDesignTag || ''} onChange={e => setNewDesignTag(e.target.value)} />
                <datalist id="cat-suggestions">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>

              {/* Source Link or File */}
              <div className="bg-slate-50 p-3 rounded-lg border">
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold">সোর্স ফাইল</label>
                  <button 
                    type="button" 
                    onClick={(e) => {
                      e.preventDefault();
                      setUseFileUpload(!useFileUpload);
                    }} 
                    className="text-xs text-indigo-600 font-bold"
                  >
                    {useFileUpload ? 'লিঙ্ক দিন' : 'ফাইল আপলোড'}
                  </button>
                </div>
                {useFileUpload ? (
                  <input type="file" onChange={handleSourceFileSelect} className="w-full text-sm" />
                ) : (
                  <input type="text" placeholder="Drive Link..." className="w-full p-2 border rounded" value={sourceLink || ''} onChange={e => setSourceLink(e.target.value)} />
                )}
              </div>

              {/* Color */}
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c.name} onClick={() => setNewDesignColor(c.name)} className={`w-8 h-8 rounded-full border-2 shadow-sm transition-transform ${newDesignColor===c.name?'ring-2 ring-indigo-500 scale-110 border-white':'border-slate-200 hover:scale-110'}`} style={{background:c.hex}} title={c.name}/>
                ))}
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button onClick={() => { setIsUploadModalOpen(false); setIsEditModalOpen(false); }} className="flex-1 py-3 border rounded-lg font-bold">বাতিল</button>
              <button 
                onClick={isEditModalOpen ? handleUpdate : handleUpload} 
                className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold"
              >
                সেভ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE REQUEST MODAL */}
      {isDeleteRequestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2 text-red-600">ডিলিট রিকোয়েস্ট পাঠান</h2>
            <p className="text-sm text-slate-500 mb-4">আপনি সরাসরি ডিলিট করতে পারবেন না। কারণ লিখে অ্যাডমিনকে পাঠান।</p>
            <textarea className="w-full p-3 border rounded-lg h-24 mb-4" placeholder="কেন ডিলিট করতে চান?" value={deleteReason || ''} onChange={e => setDeleteReason(e.target.value)}></textarea>
            <div className="flex gap-2">
              <button onClick={() => setIsDeleteRequestOpen(false)} className="flex-1 py-2 border rounded">বাতিল</button>
              <button onClick={submitDeleteRequest} className="flex-1 py-2 bg-red-600 text-white rounded font-bold">পাঠান</button>
            </div>
          </div>
        </div>
      )}

      {/* FULL VIEW */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-4 right-4 text-white"><X size={32}/></button>
          <img src={selectedImage.imageData} className="max-h-[85vh] max-w-full rounded" onClick={e => e.stopPropagation()}/>
          <div className="absolute bottom-8 bg-white px-6 py-3 rounded-full flex gap-4" onClick={e => e.stopPropagation()}>
            <button onClick={(e) => downloadImage(e, selectedImage.id, selectedImage.imageData, selectedImage.title)} className="flex gap-2 font-bold text-slate-800"><Download/> সেভ</button>
            {isDesigner && <button onClick={() => openSourceLink(selectedImage.id, selectedImage.sourceLink)} className="flex gap-2 font-bold text-indigo-600"><Unlock/> সোর্স</button>}
          </div>
        </div>
      )}

    </div>
  );
}
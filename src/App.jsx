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
  doc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp, 
  query,
  increment,
  deleteDoc
} from 'firebase/firestore';
import { 
  Upload, Search, X, Image as ImageIcon, Loader2, Lock, Unlock, 
  Trash2, LogIn, LogOut, Download, Palette, Filter, Pencil, CloudUpload, 
  Settings, LayoutDashboard, CheckCircle, XCircle,
  ArrowDownUp, RefreshCw, PlusCircle, BarChart3, Trash, Link as LinkIcon
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const COLORS = [
  { name: 'Red', hex: '#ef4444' }, { name: 'Blue', hex: '#3b82f6' }, { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#eab308' }, { name: 'Black', hex: '#1e293b' }, { name: 'White', hex: '#f8fafc' },
  { name: 'Purple', hex: '#a855f7' }, { name: 'Orange', hex: '#f97316' }, { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Multicolor', hex: 'linear-gradient(to right, #ef4444, #3b82f6, #22c55e)' }
];

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
  const [user, setUser] = useState(null);
  const [designs, setDesigns] = useState([]);
  const [deleteRequests, setDeleteRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDesigner, setIsDesigner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginType, setLoginType] = useState('designer'); 
  const [loginInput, setLoginInput] = useState({ user: '', pass: '' });
  const [config, setConfig] = useState({ designerPass: '252746', adminUser: 'akashumu', adminPass: '627425274', headerImage: '', totalViews: 0 });

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteRequestOpen, setIsDeleteRequestOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); 
  const [targetDesign, setTargetDesign] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColorFilter, setSelectedColorFilter] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortOption, setSortOption] = useState('newest');
  const [visibleCount, setVisibleCount] = useState(30);

  // Form Data
  const [newDesignTitle, setNewDesignTitle] = useState('');
  const [newDesignTag, setNewDesignTag] = useState('Sublimation');
  const [isCustomCategory, setIsCustomCategory] = useState(false); 
  const [newDesignColor, setNewDesignColor] = useState('Multicolor');
  const [sourceLink, setSourceLink] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [useImageLink, setUseImageLink] = useState(false);
  const [imageLinkInput, setImageLinkInput] = useState('');
  const [sourceFile, setSourceFile] = useState(null);
  const [useFileUpload, setUseFileUpload] = useState(false);
  const [activeUploads, setActiveUploads] = useState([]);
  const [tempScriptUrl, setTempScriptUrl] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) { console.error(err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'designs'));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDesigns(items);
      setLoading(false);
    }, (err) => console.error(err));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const q = query(collection(db, 'deleteRequests'));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeleteRequests(items);
    });
    return () => unsub();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user) return;
    const configRef = doc(db, 'settings', 'config');
    const unsub = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(prev => ({ ...prev, ...data }));
        setTempScriptUrl(data.scriptUrl || "");
      } else {
        setDoc(configRef, config, { merge: true });
      }
    });

    const viewed = sessionStorage.getItem('viewed');
    if (!viewed) {
      updateDoc(configRef, { totalViews: increment(1) }).catch(() => {});
      sessionStorage.setItem('viewed', 'true');
    }
    return () => unsub();
  }, [user]);

  const categories = useMemo(() => {
    const cats = new Set(['Sublimation', 'Full Sleeve', 'Collar', 'Half Sleeve']);
    designs.forEach(d => d.tag && cats.add(d.tag));
    return Array.from(cats).sort();
  }, [designs]);

  const filteredDesigns = useMemo(() => {
    let result = designs.filter(d => {
      const matchesSearch = d.title?.toLowerCase().includes(searchQuery.toLowerCase()) || d.tag?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesColor = selectedColorFilter === 'All' || d.color === selectedColorFilter;
      const matchesCategory = selectedCategory === 'All' || d.tag === selectedCategory;
      return matchesSearch && matchesColor && matchesCategory;
    });
    if (sortOption === 'newest') result.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    else if (sortOption === 'oldest') result.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    else if (sortOption === 'popular') result.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    else if (sortOption === 'name') result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    return result;
  }, [designs, searchQuery, selectedColorFilter, selectedCategory, sortOption]);

  const displayedDesigns = useMemo(() => filteredDesigns.slice(0, visibleCount), [filteredDesigns, visibleCount]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginType === 'admin') {
      if (loginInput.user === config.adminUser && loginInput.pass === config.adminPass) {
        setIsAdmin(true); setIsDesigner(true); setShowLoginModal(false);
      } else alert("ভুল ইউজারনেম বা পাসওয়ার্ড!");
    } else {
      if (loginInput.pass === config.designerPass) {
        setIsDesigner(true); setShowLoginModal(false);
      } else alert("ভুল পাসওয়ার্ড!");
    }
    setLoginInput({ user: '', pass: '' });
  };

  const uploadToTelegram = async (file) => {
    const data = new FormData();
    data.append("file", file);
    const res = await fetch("https://private-link-sender.onrender.com/upload", { method: "POST", body: data });
    const json = await res.json();
    if (json.success) return json.link;
    throw new Error("ফাইল ৫০ এমবির বেশি হতে পারে।");
  };

  const resetForm = () => {
    setFileToUpload(null); setPreviewUrl(null); setNewDesignTitle(''); setNewDesignTag('Sublimation'); setIsCustomCategory(false);
    setNewDesignColor('Multicolor'); setSourceLink(''); setSourceFile(null); setUseFileUpload(false);
    setUseImageLink(false); setImageLinkInput(''); setTargetDesign(null); setDeleteReason('');
  };

  const openEditModal = (e, design) => {
    if (e) e.stopPropagation();
    setTargetDesign(design);
    setNewDesignTitle(design.title || '');
    setNewDesignTag(design.tag || 'Sublimation');
    setNewDesignColor(design.color || 'Multicolor');
    setSourceLink(design.sourceLink || '');
    setPreviewUrl(design.imageData || null);
    setIsEditModalOpen(true);
  };

  const handleUpload = async (retryData = null) => {
    const activeData = retryData || { 
        title: newDesignTitle, 
        tag: newDesignTag, 
        color: newDesignColor, 
        sourceLink, 
        useFileUpload, 
        sourceFile, 
        fileToUpload, 
        imageLinkInput, 
        useImageLink, 
        imageData: previewUrl 
    };

    if (activeData.useImageLink ? (!activeData.imageLinkInput || !activeData.title) : (!activeData.fileToUpload && !activeData.imageData)) {
        return alert("নাম এবং ছবি দিন!");
    }

    const uploadId = Date.now();
    const newItem = { id: uploadId, title: activeData.title, status: 'শুরু হচ্ছে...', type: 'upload', rawData: activeData };
    setActiveUploads(prev => [...prev, newItem]);
    setIsUploadModalOpen(false);
    resetForm();

    const updateStatus = (status, isError = false) => {
      setActiveUploads(prev => prev.map(item => item.id === uploadId ? { ...item, status, isError, isComplete: !isError && status === 'সম্পন্ন!' } : item));
    };

    try {
      let finalSourceLink = activeData.sourceLink;
      if (activeData.useFileUpload && activeData.sourceFile) {
        updateStatus('সোর্স ফাইল আপলোড হচ্ছে...');
        finalSourceLink = await uploadToTelegram(activeData.sourceFile);
      }
      
      let imgDataToSave = activeData.imageData;
      if (!activeData.useImageLink && activeData.fileToUpload) {
        updateStatus('ছবি কম্প্রেস হচ্ছে...');
        imgDataToSave = await compressImage(activeData.fileToUpload);
      } else if (activeData.useImageLink) {
        imgDataToSave = activeData.imageLinkInput;
      }

      updateStatus('ডাটাবেসে সেভ হচ্ছে...');
      await addDoc(collection(db, 'designs'), { 
        title: activeData.title, 
        tag: activeData.tag, 
        color: activeData.color, 
        imageData: imgDataToSave, 
        sourceLink: finalSourceLink || '', 
        uploaderId: user?.uid || 'anon', 
        downloads: 0, 
        createdAt: serverTimestamp() 
      });
      updateStatus('সম্পন্ন!');
      setTimeout(() => setActiveUploads(prev => prev.filter(i => i.id !== uploadId)), 3000);
    } catch (err) {
      updateStatus('ব্যর্থ: ' + err.message, true);
    }
  };

  const handleUpdate = async (retryData = null) => {
    const activeData = retryData || { ...targetDesign, title: newDesignTitle, tag: newDesignTag, color: newDesignColor, sourceLink, useFileUpload, sourceFile };
    if (!activeData.id) return;

    const uploadId = Date.now();
    const newItem = { id: uploadId, title: `Update: ${activeData.title}`, status: 'শুরু হচ্ছে...', type: 'update', rawData: activeData };
    setActiveUploads(prev => [...prev, newItem]);
    setIsEditModalOpen(false);
    resetForm();

    const updateStatus = (status, isError = false) => {
      setActiveUploads(prev => prev.map(item => item.id === uploadId ? { ...item, status, isError, isComplete: !isError && status === 'সম্পন্ন!' } : item));
    };

    try {
      const updates = { 
        title: activeData.title, 
        tag: activeData.tag, 
        color: activeData.color, 
        sourceLink: activeData.sourceLink || '' 
      };
      
      if (activeData.useFileUpload && activeData.sourceFile) {
         updateStatus('সোর্স ফাইল আপলোড হচ্ছে...');
         updates.sourceLink = await uploadToTelegram(activeData.sourceFile);
      }

      updateStatus('ডাটাবেস আপডেট হচ্ছে...');
      await updateDoc(doc(db, 'designs', activeData.id), updates);
      updateStatus('সম্পন্ন!');
      setTimeout(() => setActiveUploads(prev => prev.filter(i => i.id !== uploadId)), 3000);
    } catch (err) {
      updateStatus('ব্যর্থ: ' + err.message, true);
    }
  };

  const submitDeleteRequest = async () => {
    if (!deleteReason || !targetDesign) return;
    try {
        await addDoc(collection(db, 'deleteRequests'), {
            designId: targetDesign.id,
            designTitle: targetDesign.title,
            reason: deleteReason,
            requestedBy: user?.uid || 'anon',
            createdAt: serverTimestamp()
        });
        alert("ডিলিট রিকোয়েস্ট পাঠানো হয়েছে।");
        setIsDeleteRequestOpen(false);
        resetForm();
    } catch (err) { alert(err.message); }
  };

  const approveDelete = async (req) => {
    try {
        await deleteDoc(doc(db, 'designs', req.designId));
        await deleteDoc(doc(db, 'deleteRequests', req.id));
    } catch (err) { alert(err.message); }
  };

  const downloadImage = (e, id, img, title) => {
    e.stopPropagation();
    updateDoc(doc(db, 'designs', id), { downloads: increment(1) }).catch(() => {});
    const image = new Image();
    image.src = img;
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const fontSize = Math.max(24, Math.floor(image.width * 0.04));
      canvas.width = image.width;
      canvas.height = image.height + fontSize + 40;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      ctx.fillStyle = '#000'; ctx.font = `bold ${fontSize}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(title || 'HF Sublimation', canvas.width / 2, image.height + fontSize + 10);
      const link = document.createElement('a');
      link.download = `${title}.jpg`; link.href = canvas.toDataURL('image/jpeg', 0.9); link.click();
    };
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {window.scrollTo(0, 0); setSelectedCategory('All'); setSelectedColorFilter('All');}}>
                <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg"><ImageIcon size={24} /></div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 hidden sm:block">HF Sublimation</h1>
            </div>

            <div className="flex-1 max-w-md mx-4 relative">
                <Search className="absolute left-4 top-3 text-slate-400" size={18} />
                <input type="text" placeholder="ডিজাইন খুঁজুন..." className="w-full pl-11 pr-4 py-2.5 bg-slate-100 border-none rounded-full focus:ring-2 focus:ring-indigo-500/20 text-sm" value={searchQuery || ''} onChange={(e) => setSearchQuery(e.target.value)}/>
            </div>

            <div className="flex items-center gap-2">
                {isDesigner ? (
                <>
                    {isAdmin && <button onClick={() => setShowAdminPanel(true)} className="bg-slate-800 text-white p-2.5 rounded-full hover:scale-105 transition-transform"><LayoutDashboard size={18}/></button>}
                    <button onClick={() => setIsSettingsModalOpen(true)} className="bg-slate-100 text-slate-600 p-2.5 rounded-full border border-slate-200"><Settings size={18} /></button>
                    <button onClick={() => { resetForm(); setIsUploadModalOpen(true); }} className="bg-indigo-600 text-white p-2.5 sm:px-5 sm:py-2.5 rounded-full sm:rounded-xl flex items-center gap-2 shadow-indigo-200 shadow-lg"><Upload size={18} /> <span className="hidden sm:inline">আপলোড</span></button>
                    <button onClick={() => {setIsDesigner(false); setIsAdmin(false); setShowAdminPanel(false);}} className="bg-red-50 text-red-500 p-2.5 rounded-full border border-red-100"><LogOut size={18}/></button>
                </>
                ) : <button onClick={() => setShowLoginModal(true)} className="bg-slate-800 text-white p-2.5 sm:px-5 sm:py-2.5 rounded-full sm:rounded-xl flex items-center gap-2"><LogIn size={18} /> <span className="hidden sm:inline">লগইন</span></button>}
            </div>
          </div>

          <div className="w-full flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
            <div className="flex items-center gap-2 shrink-0 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
                <ArrowDownUp size={14} className="text-indigo-600"/>
                <select className="bg-transparent text-xs font-bold outline-none text-slate-700 cursor-pointer" value={sortOption || 'newest'} onChange={(e) => setSortOption(e.target.value)}>
                    <option value="newest">নতুন আপলোড</option>
                    <option value="oldest">পুরাতন ফাইল</option>
                    <option value="popular">জনপ্রিয়তা</option>
                    <option value="name">নামানুসারে</option>
                </select>
            </div>
            
            {/* Conditional Dropdowns for Designers/Admins */}
            {isDesigner && (
              <>
                <div className="flex items-center gap-2 shrink-0 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
                    <Palette size={14} className="text-indigo-600"/>
                    <select className="bg-transparent text-xs font-bold outline-none text-slate-700 cursor-pointer" value={selectedColorFilter || 'All'} onChange={(e) => setSelectedColorFilter(e.target.value)}>
                        <option value="All">সব কালার</option>
                        {COLORS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2 shrink-0 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
                    <Filter size={14} className="text-indigo-600"/>
                    <select className="bg-transparent text-xs font-bold outline-none text-slate-700 cursor-pointer" value={selectedCategory || 'All'} onChange={(e) => setSelectedCategory(e.target.value)}>
                        <option value="All">সব ক্যাটাগরি</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* UPLOAD QUEUE with Retry/Edit logic */}
      {activeUploads.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 max-w-sm w-full">
          {activeUploads.map(item => (
            <div key={item.id} className={`bg-white p-3 rounded-lg shadow-xl border flex items-center justify-between gap-3 ${item.isComplete ? 'border-green-500 bg-green-50' : item.isError ? 'border-red-500 bg-red-50' : 'border-indigo-100'}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                {item.isComplete ? <CheckCircle className="text-green-600" size={20}/> : item.isError ? <XCircle className="text-red-600" size={20}/> : <Loader2 className="animate-spin text-indigo-600" size={20}/>}
                <div className="overflow-hidden">
                  <p className="text-sm font-bold truncate">{item.title}</p>
                  <p className={`text-xs ${item.isError ? 'text-red-500 font-bold' : 'text-slate-500'}`}>{item.status}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {item.isError && (
                  <button 
                    onClick={() => {
                        // Open the corresponding modal with old data for retry
                        if (item.type === 'update') {
                            openEditModal(null, item.rawData);
                        } else {
                            setNewDesignTitle(item.rawData.title);
                            setNewDesignTag(item.rawData.tag);
                            setNewDesignColor(item.rawData.color);
                            setSourceLink(item.rawData.sourceLink);
                            setPreviewUrl(item.rawData.imageData);
                            setUseFileUpload(item.rawData.useFileUpload);
                            setIsUploadModalOpen(true);
                        }
                    }} 
                    className="p-1.5 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 transition-colors"
                    title="Retry / Edit"
                  >
                    <RefreshCw size={14}/>
                  </button>
                )}
                <button onClick={() => setActiveUploads(prev => prev.filter(i => i.id !== item.id))} className="text-slate-400 hover:text-slate-600 p-1.5"><X size={16}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {showAdminPanel && isAdmin ? (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3/> অ্যাডমিন ড্যাশবোর্ড</h2>
                <button onClick={() => setShowAdminPanel(false)} className="bg-slate-200 px-4 py-2 rounded-lg font-bold">ফিরে যান</button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
                    <p className="text-slate-500 text-sm font-bold mb-1">মোট ডিজাইন</p>
                    <p className="text-3xl font-black text-indigo-600">{designs.length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
                    <p className="text-slate-500 text-sm font-bold mb-1">মোট ভিউ</p>
                    <p className="text-3xl font-black text-purple-600">{config.totalViews}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
                    <p className="text-slate-500 text-sm font-bold mb-1">ডিলিট রিকোয়েস্ট</p>
                    <p className="text-3xl font-black text-red-600">{deleteRequests.length}</p>
                </div>
             </div>

             <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-slate-50 font-bold flex items-center gap-2"><Trash size={18}/> ডিলিট রিকোয়েস্ট সমূহ</div>
                <div className="divide-y">
                   {deleteRequests.length === 0 ? <p className="p-8 text-center text-slate-400">কোনো রিকোয়েস্ট নেই</p> : deleteRequests.map(req => (
                     <div key={req.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <p className="font-bold text-slate-700">{req.designTitle}</p>
                            <p className="text-sm text-red-500 italic">কারণ: {req.reason}</p>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button onClick={() => deleteDoc(doc(db, 'deleteRequests', req.id))} className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 rounded-lg text-sm font-bold">বাতিল</button>
                            <button onClick={() => approveDelete(req)} className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold">অ্যাপ্রুভ</button>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        ) : (
          <>
            {displayedDesigns.length === 0 ? <div className="text-center py-20 text-slate-400">কোনো ডিজাইন পাওয়া যায়নি</div> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayedDesigns.map(design => (
                  <div key={design.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group transition-all hover:-translate-y-1 flex flex-col">
                    <div className="relative w-full aspect-[4/5] bg-slate-50 cursor-pointer" onClick={() => setSelectedImage(design)}>
                      <img src={design.imageData} alt={design.title} className="w-full h-full object-contain p-2" loading="lazy" />
                      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                          <span className="text-[10px] bg-white text-indigo-600 px-2 py-1 rounded shadow-sm font-bold uppercase border border-indigo-50">{design.tag}</span>
                          <div className="w-3.5 h-3.5 rounded-full border border-white" style={{ background: COLORS.find(c => c.name === design.color)?.hex || design.color }}></div>
                      </div>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-3">
                         <h3 className="font-bold text-slate-700 text-sm line-clamp-1">{design.title}</h3>
                         {isDesigner && (
                           <div className="flex gap-1">
                            <button onClick={(e) => openEditModal(e, design)} className="text-slate-300 hover:text-indigo-500 p-1"><Pencil size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setTargetDesign(design); setIsDeleteRequestOpen(true); }} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                           </div>
                         )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-auto">
                        <button onClick={(e) => downloadImage(e, design.id, design.imageData, design.title)} className="bg-slate-50 text-slate-600 border border-slate-200 py-2 rounded-xl text-[11px] font-bold hover:bg-slate-100 flex items-center justify-center gap-1"><Download size={12}/> ছবি</button>
                        {isDesigner && <button onClick={() => { window.open(design.sourceLink, '_blank'); updateDoc(doc(db, 'designs', design.id), { downloads: increment(1) }); }} className="bg-indigo-600 text-white py-2 rounded-xl text-[11px] font-bold hover:bg-indigo-700 flex items-center justify-center gap-1"><Unlock size={12}/> AI ফাইল</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {visibleCount < filteredDesigns.length && <div className="mt-10 text-center"><button onClick={() => setVisibleCount(prev => prev + 30)} className="bg-white border border-slate-300 text-slate-600 px-8 py-2.5 rounded-full font-bold hover:bg-slate-50 shadow-sm transition-all">আরও দেখুন</button></div>}
          </>
        )}
      </main>

      {/* UPLOAD / EDIT MODAL */}
      {(isUploadModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg h-[90vh] overflow-y-auto relative shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">{isEditModalOpen ? <Pencil size={20}/> : <PlusCircle size={20}/>} {isEditModalOpen ? 'এডিট ডিজাইন' : 'নতুন আপলোড'}</h2>
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border">
                  {!isEditModalOpen && (
                    <div className="flex gap-2 mb-4 bg-white p-1 rounded-lg">
                        <button onClick={() => {setUseImageLink(false); setPreviewUrl(null);}} className={`flex-1 py-1.5 text-[11px] font-bold rounded-md ${!useImageLink ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}>ফাইল</button>
                        <button onClick={() => {setUseImageLink(true); setPreviewUrl(null);}} className={`flex-1 py-1.5 text-[11px] font-bold rounded-md ${useImageLink ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}>লিংক</button>
                    </div>
                  )}
                  {(!useImageLink || isEditModalOpen) ? (
                      <div className="border-2 border-dashed border-indigo-200 bg-white rounded-xl p-4 text-center relative hover:border-indigo-400 group transition-colors">
                          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files[0]; if(f){ setFileToUpload(f); setPreviewUrl(URL.createObjectURL(f)); }}} className="absolute inset-0 opacity-0 cursor-pointer"/>
                          {previewUrl ? <img src={previewUrl} className="h-32 mx-auto object-contain rounded shadow-sm" /> : <div className="py-8 text-slate-400 group-hover:text-indigo-500"><CloudUpload className="mx-auto mb-2" size={32}/> ছবি সিলেক্ট করুন</div>}
                      </div>
                  ) : <input type="text" placeholder="ইমেজ লিংক (Direct URL)..." className="w-full p-3 border rounded-lg text-sm" value={imageLinkInput || ''} onChange={(e) => {setImageLinkInput(e.target.value); setPreviewUrl(e.target.value);}} />}
              </div>

              <input type="text" placeholder="ডিজাইনের নাম" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={newDesignTitle || ''} onChange={e => setNewDesignTitle(e.target.value)} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                   <div className="flex justify-between items-center">
                       <label className="text-[11px] font-bold text-slate-500">ক্যাটাগরি</label>
                       <button onClick={() => setIsCustomCategory(!isCustomCategory)} className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                           {isCustomCategory ? <><Filter size={10}/> সিলেক্ট করুন</> : <><PlusCircle size={10}/> লিখুন</>}
                       </button>
                   </div>
                   {isCustomCategory ? (
                       <input type="text" placeholder="ক্যাটাগরি লিখুন..." className="w-full p-2.5 border rounded-lg text-sm" value={newDesignTag || ''} onChange={e => setNewDesignTag(e.target.value)} autoFocus />
                   ) : (
                       <select className="w-full p-2.5 border rounded-lg text-sm" value={newDesignTag || 'Sublimation'} onChange={e => setNewDesignTag(e.target.value)}>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                   )}
                </div>
                <div className="space-y-1">
                   <label className="text-[11px] font-bold text-slate-500">কালার</label>
                   <select className="w-full p-2.5 border rounded-lg text-sm" value={newDesignColor || 'Multicolor'} onChange={e => setNewDesignColor(e.target.value)}>
                      {COLORS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                   </select>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border">
                <div className="flex justify-between mb-2"><label className="text-xs font-bold text-slate-600">সোর্স ফাইল (AI/PSD)</label><button onClick={() => setUseFileUpload(!useFileUpload)} className="text-[10px] bg-white px-2 py-1 border rounded shadow-sm text-indigo-600 font-bold">{useFileUpload ? 'লিঙ্ক দিন' : 'ফাইল আপলোড'}</button></div>
                {useFileUpload ? (
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border">
                        <LinkIcon size={14} className="text-slate-400"/>
                        <input type="file" onChange={(e) => setSourceFile(e.target.files[0])} className="w-full text-xs" />
                    </div>
                ) : (
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border">
                        <LinkIcon size={14} className="text-slate-400"/>
                        <input type="text" placeholder="Drive বা সোর্স লিঙ্ক দিন..." className="w-full text-xs outline-none" value={sourceLink || ''} onChange={e => setSourceLink(e.target.value)} />
                    </div>
                )}
              </div>
            </div>
            <div className="flex gap-4 mt-8 sticky bottom-0 bg-white pt-4">
              <button onClick={() => { setIsUploadModalOpen(false); setIsEditModalOpen(false); resetForm(); }} className="flex-1 py-3 border rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">বাতিল</button>
              <button onClick={() => isEditModalOpen ? handleUpdate() : handleUpload()} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">সেভ করুন</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE REQUEST MODAL */}
      {isDeleteRequestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
            <h2 className="font-bold mb-4 flex items-center gap-2 text-red-600"><Trash2 size={20}/> ডিলিট রিকোয়েস্ট</h2>
            <textarea className="w-full p-3 border rounded-lg h-24 mb-4 text-sm" placeholder="কেন ডিলিট করতে চান? কারণ লিখুন..." value={deleteReason || ''} onChange={e => setDeleteReason(e.target.value)}></textarea>
            <div className="flex gap-2">
              <button onClick={() => setIsDeleteRequestOpen(false)} className="flex-1 py-2 border rounded-lg font-bold">বাতিল</button>
              <button onClick={submitDeleteRequest} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold">পাঠান</button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md relative">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Settings size={20}/> সিস্টেম সেটিংস</h2>
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">গুগল ড্রাইভ স্ক্রিপ্ট ইউআরএল</label>
                    <textarea rows={3} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-mono text-slate-600" value={tempScriptUrl || ''} onChange={(e) => setTempScriptUrl(e.target.value)} placeholder="Google Web App URL..."/>
                </div>
                {isAdmin && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">অ্যাডমিন পাসওয়ার্ড</label>
                        <input type="text" className="w-full p-2 border rounded-lg text-sm" value={config.adminPass} onChange={e => setConfig({...config, adminPass: e.target.value})}/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">ডিজাইনার পাসওয়ার্ড</label>
                        <input type="text" className="w-full p-2 border rounded-lg text-sm" value={config.designerPass} onChange={e => setConfig({...config, designerPass: e.target.value})}/>
                    </div>
                  </div>
                )}
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setIsSettingsModalOpen(false)} className="flex-1 py-3 rounded-xl border text-slate-600 font-bold">বাতিল</button>
              <button onClick={async () => { await setDoc(doc(db, "settings", "config"), { scriptUrl: tempScriptUrl, adminPass: config.adminPass, designerPass: config.designerPass }, { merge: true }); setIsSettingsModalOpen(false); alert("সেভ হয়েছে!"); }} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">সেভ করুন</button>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-8 rounded-2xl w-full max-w-xs relative shadow-2xl animate-in fade-in zoom-in duration-200">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-400"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-6 text-center">সিস্টেম লগইন</h2>
            <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
              <button onClick={() => setLoginType('designer')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${loginType==='designer'?'bg-white shadow text-indigo-600':'text-slate-500'}`}>ডিজাইনার</button>
              <button onClick={() => setLoginType('admin')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${loginType==='admin'?'bg-white shadow text-indigo-600':'text-slate-500'}`}>অ্যাডমিন</button>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              {loginType === 'admin' && <input type="text" placeholder="ইউজারনেম" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={loginInput.user || ''} onChange={e => setLoginInput({...loginInput, user: e.target.value})} />}
              <input type="password" placeholder="পাসওয়ার্ড" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={loginInput.pass || ''} onChange={e => setLoginInput({...loginInput, pass: e.target.value})} />
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-100">লগইন করুন</button>
            </form>
          </div>
        </div>
      )}

      {/* FULL PREVIEW */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 animate-in fade-in duration-300" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-6 right-6 text-white hover:scale-110 transition-transform"><X size={32}/></button>
          <img src={selectedImage.imageData} className="max-h-[85vh] max-w-full rounded shadow-2xl" onClick={e => e.stopPropagation()}/>
          <div className="absolute bottom-8 bg-white/10 backdrop-blur-xl border border-white/20 px-8 py-3 rounded-full flex gap-6 text-white" onClick={e => e.stopPropagation()}>
            <button onClick={(e) => downloadImage(e, selectedImage.id, selectedImage.imageData, selectedImage.title)} className="flex items-center gap-2 font-bold text-sm hover:text-indigo-400 transition-colors"><Download size={20}/> সেভ ইমেজ</button>
            {isDesigner && <button onClick={() => window.open(selectedImage.sourceLink, '_blank')} className="flex items-center gap-2 font-bold text-sm hover:text-indigo-400 transition-colors"><Unlock size={20}/> সোর্স ফাইল</button>}
          </div>
        </div>
      )}

    </div>
  );
}

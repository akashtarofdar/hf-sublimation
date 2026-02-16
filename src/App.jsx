import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  getDoc,
  onSnapshot, 
  serverTimestamp, 
  query,
  increment,
  deleteDoc,
  where
} from 'firebase/firestore';
import { 
  Upload, Search, X, Image as ImageIcon, Loader2, Lock, Unlock, 
  Trash2, LogIn, LogOut, Download, Palette, Filter, Pencil, CloudUpload, 
  Settings, LayoutDashboard, CheckCircle, XCircle,
  ArrowDownUp, RefreshCw, PlusCircle, BarChart3, Trash, Link as LinkIcon,
  Layers, Copy, Save, FileText, FileImage, Share2, User, UserX, AlertTriangle, ShieldAlert
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

// Updated COLORS with Bangla Labels
const COLORS = [
  { name: 'Red', label: 'লাল', hex: '#ef4444', rgb: [239, 68, 68] }, 
  { name: 'Blue', label: 'নীল', hex: '#3b82f6', rgb: [59, 130, 246] }, 
  { name: 'Green', label: 'সবুজ', hex: '#22c55e', rgb: [34, 197, 94] },
  { name: 'Yellow', label: 'হলুদ', hex: '#eab308', rgb: [234, 179, 8] }, 
  { name: 'Black', label: 'কালো', hex: '#1e293b', rgb: [30, 41, 59] }, 
  { name: 'White', label: 'সাদা', hex: '#f8fafc', rgb: [248, 250, 252] },
  { name: 'Purple', label: 'বেগুনি', hex: '#a855f7', rgb: [168, 85, 247] }, 
  { name: 'Orange', label: 'কমলা', hex: '#f97316', rgb: [249, 115, 22] }, 
  { name: 'Cyan', label: 'আসমানি', hex: '#06b6d4', rgb: [6, 182, 212] },
  { name: 'Multicolor', label: 'মাল্টিকালার', hex: 'linear-gradient(to right, #ef4444, #3b82f6, #22c55e)', rgb: null }
];

// Helper to find closest color
const getDominantColor = (imgElement) => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 100; // Resize for speed
    canvas.height = 100;
    ctx.drawImage(imgElement, 0, 0, 100, 100);
    const data = ctx.getImageData(0, 0, 100, 100).data;
    
    let r=0, g=0, b=0, count=0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i+1]; b += data[i+2]; count++;
    }
    r = Math.floor(r/count); g = Math.floor(g/count); b = Math.floor(b/count);

    let closest = 'Multicolor';
    let minDiff = Infinity;

    COLORS.forEach(c => {
      if (!c.rgb) return;
      const diff = Math.sqrt(Math.pow(r - c.rgb[0], 2) + Math.pow(g - c.rgb[1], 2) + Math.pow(b - c.rgb[2], 2));
      if (diff < minDiff) {
        minDiff = diff;
        closest = c.name;
      }
    });
    return closest;
  } catch (e) {
    return 'Multicolor';
  }
};

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
  const [userProfile, setUserProfile] = useState(null); // { name, whatsapp, isBanned, warning }
  const [designs, setDesigns] = useState([]);
  const [usersList, setUsersList] = useState([]); // Admin only
  const [deleteRequests, setDeleteRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDesigner, setIsDesigner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false); // For source file access
  const [loginType, setLoginType] = useState('designer'); 
  const [loginInput, setLoginInput] = useState({ user: '', pass: '' });
  const [registerInput, setRegisterInput] = useState({ name: '', whatsapp: '' });
  const [config, setConfig] = useState({ designerPass: '252746', adminUser: 'akashumu', adminPass: '627425274', headerImage: '', totalViews: 0 });

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteRequestOpen, setIsDeleteRequestOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); 
  const [targetDesign, setTargetDesign] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminView, setAdminView] = useState('dashboard');
  
  // New Bulk Upload State
  const [showBulkUpload, setShowBulkUpload] = useState(false);

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
  const [designPassword, setDesignPassword] = useState(''); // New for Lock
  const [isLocked, setIsLocked] = useState(false); // New for Lock
  const [unlockInput, setUnlockInput] = useState(''); // For user to enter password

  const [activeUploads, setActiveUploads] = useState([]);
  const [tempScriptUrl, setTempScriptUrl] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  // --- INITIALIZATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) { console.error(err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Check URL params for shared link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('id');
    if (sharedId && designs.length > 0) {
      const found = designs.find(d => d.id === sharedId);
      if (found) setSelectedImage(found);
    }
  }, [designs]);

  // Fetch User Profile
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      }
    });
    return () => unsub();
  }, [user]);

  // Fetch Designs
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

  // Fetch Admin Data
  useEffect(() => {
    if (!user || !isAdmin) return;
    const qDel = query(collection(db, 'deleteRequests'));
    const unsubDel = onSnapshot(qDel, (snap) => setDeleteRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snap) => setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubDel(); unsubUsers(); };
  }, [user, isAdmin]);

  // Fetch Config
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

  // --- MEMOS ---
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

  // --- ACTIONS ---
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

  const handleLogout = () => {
    setIsDesigner(false);
    setIsAdmin(false);
    setShowAdminPanel(false);
  };

  const handleUserRegister = async (e) => {
    e.preventDefault();
    if (!registerInput.name || !registerInput.whatsapp) return alert("সব তথ্য দিন");
    
    try {
        await setDoc(doc(db, 'users', user.uid), {
            name: registerInput.name,
            whatsapp: registerInput.whatsapp,
            isBanned: false,
            createdAt: serverTimestamp(),
            uid: user.uid
        }, { merge: true });
        setShowRegisterModal(false);
        alert("স্বাগতম! এখন আপনি সোর্স ফাইল ডাউনলোড করতে পারবেন।");
    } catch (err) {
        alert("সমস্যা হয়েছে, আবার চেষ্টা করুন।");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setFileToUpload(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setUseImageLink(false);
      
      // Auto Color Detection
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const detected = getDominantColor(img);
        setNewDesignColor(detected);
      }
    }
  };

  const handleImageLinkChange = (e) => {
      const url = e.target.value;
      setImageLinkInput(url);
      setPreviewUrl(url);
  };

  const handleSourceFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSourceFile(file);
    }
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
    setIsLocked(false); setDesignPassword('');
  };

  const openEditModal = (e, design) => {
    if (e) e.stopPropagation();
    setTargetDesign(design);
    setNewDesignTitle(design.title || '');
    setNewDesignTag(design.tag || 'Sublimation');
    setNewDesignColor(design.color || 'Multicolor');
    setSourceLink(design.sourceLink || '');
    setPreviewUrl(design.imageData || null);
    setIsLocked(design.isLocked || false);
    setDesignPassword(design.password || '');
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
        imageData: previewUrl,
        isLocked,
        password: designPassword
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
        isLocked: isAdmin ? (activeData.isLocked || false) : false,
        password: isAdmin ? (activeData.password || '') : '',
        createdAt: serverTimestamp() 
      });
      updateStatus('সম্পন্ন!');
      setTimeout(() => setActiveUploads(prev => prev.filter(i => i.id !== uploadId)), 3000);
    } catch (err) {
      updateStatus('ব্যর্থ: ' + err.message, true);
    }
  };

  const handleUpdate = async (retryData = null) => {
    const activeData = retryData || { ...targetDesign, title: newDesignTitle, tag: newDesignTag, color: newDesignColor, sourceLink, useFileUpload, sourceFile, isLocked, password: designPassword };
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

      if (isAdmin) {
          updates.isLocked = activeData.isLocked;
          updates.password = activeData.password;
      }
      
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

  const openSourceLink = (design) => {
    // 1. Check if user is registered
    if (!isDesigner && !isAdmin) {
        if (!userProfile?.name) {
            setShowRegisterModal(true);
            return;
        }
        if (userProfile?.isBanned) {
            alert("আপনার অ্যাকাউন্ট ব্যান করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।");
            return;
        }
    }

    // 2. Check Lock
    if (design.isLocked && !isDesigner && !isAdmin) {
        if (unlockInput !== design.password) {
            const pass = prompt("এই ফাইলটি লক করা। পাসওয়ার্ড দিন:");
            if (pass !== design.password) {
                return alert("ভুল পাসওয়ার্ড!");
            }
        }
    }

    window.open(design.sourceLink, '_blank');
    updateDoc(doc(db, 'designs', design.id), {
      downloads: increment(1)
    }).catch(e => console.log("Popularity update failed", e));
  };

  const shareDesign = (id) => {
      const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
      // Fallback copy method
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert("লিংক কপি হয়েছে!");
      } catch (err) {
        alert("লিংক কপি করা যায়নি।");
      }
      document.body.removeChild(textArea);
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

  const toggleUserBan = async (u) => {
      await updateDoc(doc(db, 'users', u.id), { isBanned: !u.isBanned });
  };

  const sendUserWarning = async (u) => {
      const msg = prompt("ওয়ার্নিং মেসেজ লিখুন:", u.warning || "");
      if (msg !== null) {
          await updateDoc(doc(db, 'users', u.id), { warning: msg });
      }
  };

  // --- BULK UPLOAD COMPONENT ---
  const BulkUploadDashboard = () => {
      return <div className="p-8 text-center bg-white rounded">বাল্ক আপলোড ফিচারটি (Bulk Upload) এখানে লোড হবে...</div>
  };

  // --- MAIN RENDER ---
  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;
  if (showBulkUpload && isDesigner) return <BulkUploadDashboard />;
  
  if (showAdminPanel && isAdmin) return (
      <div className="fixed inset-0 z-[100] bg-slate-100 overflow-auto font-sans">
        <div className="flex h-screen">
          <div className="w-64 bg-slate-900 text-white p-6 flex flex-col">
            <h2 className="text-2xl font-bold mb-8 text-indigo-400">Admin Panel</h2>
            <nav className="space-y-2 flex-1">
              <button onClick={() => setAdminView('dashboard')} className={`w-full text-left p-3 rounded ${adminView==='dashboard' ? 'bg-indigo-600' : 'hover:bg-slate-800'}`}><LayoutDashboard className="inline mr-2" size={18}/> ড্যাশবোর্ড</button>
              <button onClick={() => setAdminView('users')} className={`w-full text-left p-3 rounded ${adminView==='users' ? 'bg-indigo-600' : 'hover:bg-slate-800'}`}><User className="inline mr-2" size={18}/> ইউজারস</button>
              <button onClick={() => setAdminView('locked')} className={`w-full text-left p-3 rounded ${adminView==='locked' ? 'bg-indigo-600' : 'hover:bg-slate-800'}`}><Lock className="inline mr-2" size={18}/> লকড ফাইলস</button>
              <button onClick={() => setShowAdminPanel(false)} className="bg-slate-800 p-3 rounded text-center hover:bg-red-600 transition w-full mt-4">Back to Site</button>
            </nav>
          </div>
          <div className="flex-1 p-8 overflow-y-auto">
             {adminView === 'dashboard' && (
                 <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
                            <p className="text-slate-500 text-sm font-bold mb-1">মোট ডিজাইন</p>
                            <p className="text-3xl font-black text-indigo-600">{designs.length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
                            <p className="text-slate-500 text-sm font-bold mb-1">মোট ভিউস</p>
                            <p className="text-3xl font-black text-purple-600">{config.totalViews}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
                            <p className="text-slate-500 text-sm font-bold mb-1">মোট ডাউনলোড</p>
                            <p className="text-3xl font-black text-green-600">{designs.reduce((acc, curr) => acc + (curr.downloads || 0), 0)}</p>
                        </div>
                    </div>
                    {/* Delete Requests */}
                    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                        <div className="p-4 border-b bg-slate-50 font-bold flex items-center gap-2"><Trash size={18}/> ডিলিট রিকোয়েস্ট ({deleteRequests.length})</div>
                        <div className="divide-y">
                        {deleteRequests.length === 0 ? <p className="p-8 text-center text-slate-400">কোনো রিকোয়েস্ট নেই</p> : deleteRequests.map(req => (
                            <div key={req.id} className="p-4 flex justify-between items-center">
                                <div><p className="font-bold">{req.designTitle}</p><p className="text-sm text-red-500">{req.reason}</p></div>
                                <div className="flex gap-2">
                                    <button onClick={() => deleteDoc(doc(db, 'deleteRequests', req.id))} className="px-3 py-1 bg-slate-100 rounded">বাতিল</button>
                                    <button onClick={async () => { await deleteDoc(doc(db, 'designs', req.designId)); await deleteDoc(doc(db, 'deleteRequests', req.id)); }} className="px-3 py-1 bg-red-600 text-white rounded">ডিলিট</button>
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                 </div>
             )}

             {adminView === 'users' && (
                 <div className="bg-white rounded-2xl shadow-sm border overflow-hidden animate-in fade-in">
                     <div className="p-4 border-b bg-slate-50 font-bold">নিবন্ধিত ইউজার ({usersList.length})</div>
                     <table className="w-full text-left">
                         <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">নাম</th><th className="p-4">WhatsApp</th><th className="p-4">স্ট্যাটাস</th><th className="p-4">অ্যাকশন</th></tr></thead>
                         <tbody className="divide-y">
                             {usersList.map(u => (
                                 <tr key={u.id} className="hover:bg-slate-50">
                                     <td className="p-4 font-bold">{u.name}</td>
                                     <td className="p-4 font-mono text-sm">{u.whatsapp}</td>
                                     <td className="p-4">{u.isBanned ? <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded">BANNED</span> : <span className="text-green-600 bg-green-50 px-2 py-1 rounded">Active</span>}</td>
                                     <td className="p-4 flex gap-2">
                                         <button onClick={() => toggleUserBan(u)} className={`p-2 rounded ${u.isBanned ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{u.isBanned ? <CheckCircle size={16}/> : <UserX size={16}/>}</button>
                                         <button onClick={() => sendUserWarning(u)} className="p-2 rounded bg-yellow-100 text-yellow-600"><AlertTriangle size={16}/></button>
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
             )}

             {adminView === 'locked' && (
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in">
                     {designs.filter(d => d.isLocked).map(d => (
                         <div key={d.id} className="bg-white p-3 rounded-xl border relative group">
                             <img src={d.imageData} className="h-32 w-full object-contain mb-2 rounded bg-slate-50"/>
                             <p className="font-bold text-xs truncate">{d.title}</p>
                             <p className="text-xs text-slate-500 font-mono">Pass: {d.password}</p>
                             <button 
                                onClick={async () => await updateDoc(doc(db, 'designs', d.id), { isLocked: false, password: '' })}
                                className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                title="আনলক করুন"
                             >
                                 <Unlock size={14}/>
                             </button>
                         </div>
                     ))}
                     {designs.filter(d => d.isLocked).length === 0 && <p className="text-slate-400 col-span-4 text-center">কোনো লক করা ফাইল নেই</p>}
                 </div>
             )}
          </div>
        </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* WARNING MESSAGE FOR BANNED/WARNED USERS */}
      {userProfile?.warning && (
          <div className="bg-yellow-50 border-b border-yellow-200 p-3 text-center text-sm font-bold text-yellow-800 flex items-center justify-center gap-2">
              <ShieldAlert size={16}/> অ্যাডমিন বার্তা: {userProfile.warning}
          </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-5 flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => {window.scrollTo(0, 0); setSelectedCategory('All'); setSelectedColorFilter('All');}}>
                <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200"><ImageIcon size={24} /></div>
                <div><h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 hidden sm:block">HF Sublimation</h1><h1 className="text-xl font-bold text-indigo-700 sm:hidden">HF</h1></div>
            </div>

            <div className="flex-1 max-w-md mx-4 relative group">
                <Search className="absolute left-4 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input type="text" placeholder="ডিজাইন খুঁজুন..." className="w-full pl-11 pr-4 py-2.5 bg-slate-100 border-none rounded-full focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all shadow-inner outline-none text-sm font-medium" value={searchQuery || ''} onChange={(e) => setSearchQuery(e.target.value)}/>
            </div>

            <div className="flex items-center gap-2">
                {isDesigner ? (
                <>
                    <button onClick={() => setShowBulkUpload(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-2.5 rounded-full hover:shadow-lg transition-all" title="বাল্ক আপলোড"><Layers size={18}/></button>
                    {isAdmin && <button onClick={() => setShowAdminPanel(true)} className="bg-slate-800 text-white p-2.5 rounded-full" title="Admin Panel"><LayoutDashboard size={18}/></button>}
                    <button onClick={() => setIsSettingsModalOpen(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2.5 rounded-full border border-slate-200 transition-colors" title="সেটিংস"><Settings size={18} /></button>
                    <button onClick={() => { resetForm(); setIsUploadModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 sm:px-5 sm:py-2.5 rounded-full sm:rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-200" title="আপলোড"><Upload size={18} /> <span className="hidden sm:inline">আপলোড</span></button>
                    <button onClick={handleLogout} className="bg-red-50 text-red-500 p-2.5 rounded-full border border-red-100"><LogOut size={18}/></button>
                </>
                ) : <button onClick={() => setShowLoginModal(true)} className="bg-slate-800 hover:bg-slate-900 text-white p-2.5 sm:px-5 sm:py-2.5 rounded-full sm:rounded-xl flex items-center gap-2 shadow-md"><LogIn size={18} /> <span className="hidden sm:inline">লগইন</span></button>}
            </div>
          </div>

          <div className="w-full overflow-x-auto pb-1 no-scrollbar flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
               <ArrowDownUp size={14} className="text-indigo-600"/>
               <select className="bg-transparent text-xs font-bold outline-none text-slate-700 cursor-pointer" value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                  <option value="newest">নতুন</option>
                  <option value="oldest">পুরাতন</option>
                  <option value="popular">জনপ্রিয়</option>
                  <option value="name">নাম (A-Z)</option>
               </select>
            </div>
            
            {/* Color Filter (Visible to All) */}
            <div className="flex items-center gap-2 shrink-0 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
                <Palette size={14} className="text-indigo-600"/>
                <select className="bg-transparent text-xs font-bold outline-none text-slate-700 cursor-pointer" value={selectedColorFilter || 'All'} onChange={(e) => setSelectedColorFilter(e.target.value)}>
                    <option value="All">সব কালার</option>
                    {COLORS.map(c => <option key={c.name} value={c.name}>{c.label}</option>)}
                </select>
            </div>

            {/* Category Filter (Designer Only) */}
            {isDesigner && (
              <div className="flex items-center gap-2 shrink-0 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
                  <Filter size={14} className="text-indigo-600"/>
                  <select className="bg-transparent text-xs font-bold outline-none text-slate-700 cursor-pointer" value={selectedCategory || 'All'} onChange={(e) => setSelectedCategory(e.target.value)}>
                      <option value="All">সব ক্যাটাগরি</option>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
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
                {item.isComplete ? <CheckCircle className="text-green-600 shrink-0" size={20}/> : item.isError ? <XCircle className="text-red-600 shrink-0" size={20}/> : <Loader2 className="animate-spin text-indigo-600 shrink-0" size={20}/>}
                <div className="overflow-hidden"><p className="text-sm font-bold text-slate-700 truncate">{item.title}</p><p className={`text-xs ${item.isComplete ? 'text-green-600' : item.isError ? 'text-red-500' : 'text-slate-500'}`}>{item.status}</p></div>
              </div>
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
                <div key={design.id} className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden group transition-all duration-300 hover:-translate-y-1 flex flex-col">
                  <div className="relative w-full aspect-[4/5] bg-slate-50 overflow-hidden cursor-pointer border-b border-slate-50" onClick={() => setSelectedImage(design)}>
                    <img src={design.imageData} alt={design.title} className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    {design.isLocked && <div className="absolute top-3 left-3 bg-red-600 text-white p-1.5 rounded-full shadow-lg"><Lock size={12}/></div>}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                        <span className="text-[10px] bg-white/90 backdrop-blur text-indigo-600 px-2.5 py-1 rounded-md shadow-sm font-bold tracking-wide uppercase border border-indigo-50">{design.tag}</span>
                        {design.color && <div className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: COLORS.find(c => c.name === design.color)?.hex || design.color }} title={design.color}></div>}
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-4">
                       <h3 className="font-bold text-slate-700 text-base leading-tight line-clamp-2" title={design.title}>{design.title}</h3>
                       {isDesigner && (
                         <div className="flex gap-1 -mt-1 -mr-2">
                          <button onClick={(e) => openEditModal(e, design)} className="text-slate-300 hover:text-indigo-500 transition-colors p-1"><Pencil size={16} /></button>
                          <button onClick={(e) => { e.stopPropagation(); setTargetDesign(design); setIsDeleteRequestOpen(true); }} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>
                         </div>
                       )}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <button onClick={(e) => downloadImage(e, design.id, design.imageData, design.title)} className="bg-slate-50 text-slate-600 border border-slate-200 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-100 hover:text-indigo-600 hover:border-indigo-100 transition-all flex items-center justify-center gap-1.5"><Download size={14} /> ছবি সেভ</button>
                      <button onClick={() => openSourceLink(design)} className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-white shadow-sm ${design.isLocked ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{design.isLocked ? <Lock size={14}/> : <Unlock size={14} />} AI ফাইল</button>
                      <button onClick={() => shareDesign(design.id)} className="text-xs text-center text-slate-400 hover:text-indigo-600 flex items-center justify-center gap-1 mt-1"><Share2 size={12}/> শেয়ার করুন</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {visibleCount < filteredDesigns.length && (
              <div className="mt-10 text-center"><button onClick={() => setVisibleCount(prev => prev + 30)} className="bg-white border border-slate-300 text-slate-600 px-8 py-3 rounded-full font-bold hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition-all">আরও ডিজাইন দেখুন ({filteredDesigns.length - visibleCount} টি বাকি)</button></div>
            )}
          </>
        )}
      </main>

      {/* --- MODALS --- */}
      
      {/* UPLOAD / EDIT */}
      {(isUploadModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg h-[90vh] overflow-y-auto relative">
            <h2 className="text-lg font-bold mb-4">{isEditModalOpen ? 'এডিট ডিজাইন' : 'নতুন আপলোড'}</h2>
            <div className="space-y-4">
              
              {/* Telegram Bot Notice */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-xs text-blue-800 flex gap-2">
                  <AlertTriangle className="shrink-0" size={16}/>
                  <div>
                      <span className="font-bold">বড় ফাইল (৫০MB+) আপলোড নির্দেশিকা:</span>
                      <p>আপনার ফাইল ৫০ এমবির বেশি হলে আমাদের টেলিগ্রাম বোট <span className="font-mono bg-white px-1 rounded">@PrivateLinkSender_bot</span> এ পাঠান। বোটটি যে লিংক দিবে সেটি কপি করে নিচের "সোর্স ফাইল" বক্সে পেস্ট করুন।</p>
                  </div>
              </div>

              {isUploadModalOpen && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex gap-2 mb-4 bg-white p-1 rounded-lg border border-slate-200">
                        <button onClick={() => { setUseImageLink(false); setPreviewUrl(null); setImageLinkInput(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-all ${!useImageLink ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><FileImage size={14}/> ফাইল আপলোড</button>
                        <button onClick={() => { setUseImageLink(true); setPreviewUrl(null); setFileToUpload(null); }} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-all ${useImageLink ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><LinkIcon size={14}/> ইমেজ লিংক</button>
                    </div>
                    {!useImageLink ? (
                        <div className="border-2 border-dashed border-indigo-200 bg-white rounded-xl p-4 text-center relative hover:border-indigo-400 transition-colors">
                            <input type="file" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer"/>
                            {previewUrl ? <img src={previewUrl} className="h-32 mx-auto object-contain rounded" /> : <div className="py-8 text-slate-400"><CloudUpload className="mx-auto mb-2 text-indigo-400"/> ছবি সিলেক্ট করুন <br/><span className="text-[10px] text-slate-400">(অটো কালার ডিটেকশন অন)</span></div>}
                        </div>
                    ) : (
                        <div>
                            <input type="text" placeholder="ছবির ডাইরেক্ট লিংক পেস্ট করুন..." className="w-full p-3 border rounded-lg text-sm bg-white outline-none" value={imageLinkInput || ''} onChange={handleImageLinkChange}/>
                            {previewUrl && <div className="mt-3 bg-white p-2 rounded border text-center"><img src={previewUrl} className="h-32 mx-auto object-contain rounded" onError={(e) => e.target.style.display='none'}/></div>}
                        </div>
                    )}
                </div>
              )}

              <input type="text" placeholder="ডিজাইনের নাম" className="w-full p-3 border rounded-lg" value={newDesignTitle || ''} onChange={e => setNewDesignTitle(e.target.value)} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                   <div className="flex justify-between items-center"><label className="text-[11px] font-bold text-slate-500">ক্যাটাগরি</label><button onClick={() => setIsCustomCategory(!isCustomCategory)} className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">{isCustomCategory ? <><Filter size={10}/> সিলেক্ট করুন</> : <><PlusCircle size={10}/> লিখুন</>}</button></div>
                   {isCustomCategory ? <input type="text" placeholder="ক্যাটাগরি লিখুন..." className="w-full p-2.5 border rounded-lg text-sm" value={newDesignTag || ''} onChange={e => setNewDesignTag(e.target.value)} autoFocus /> : <select className="w-full p-2.5 border rounded-lg text-sm" value={newDesignTag || 'Sublimation'} onChange={e => setNewDesignTag(e.target.value)}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>}
                </div>
                <div className="space-y-1">
                   <label className="text-[11px] font-bold text-slate-500">কালার (অটো ডিটেক্টেড)</label>
                   <select className="w-full p-2.5 border rounded-lg text-sm" value={newDesignColor || 'Multicolor'} onChange={e => setNewDesignColor(e.target.value)}>{COLORS.map(c => <option key={c.name} value={c.name}>{c.label}</option>)}</select>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border">
                <div className="flex justify-between mb-2"><label className="text-xs font-bold">সোর্স ফাইল (AI/PSD)</label><button onClick={() => setUseFileUpload(!useFileUpload)} className="text-xs text-indigo-600 font-bold">{useFileUpload ? 'লিঙ্ক দিন' : 'ফাইল আপলোড'}</button></div>
                {useFileUpload ? <input type="file" onChange={handleSourceFileSelect} className="w-full text-sm" /> : <input type="text" placeholder="লিংক পেস্ট করুন..." className="w-full p-2 border rounded" value={sourceLink || ''} onChange={e => setSourceLink(e.target.value)} />}
              </div>

              {/* Lock Feature (Admin Only) */}
              {isAdmin && (
                  <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 mb-2">
                          <input type="checkbox" id="lockCheck" checked={isLocked} onChange={e => setIsLocked(e.target.checked)} className="w-4 h-4"/>
                          <label htmlFor="lockCheck" className="text-sm font-bold text-red-800 flex items-center gap-1"><Lock size={14}/> ফাইল লক করুন</label>
                      </div>
                      {isLocked && (
                          <input type="text" placeholder="পাসওয়ার্ড সেট করুন" className="w-full p-2 border rounded text-sm" value={designPassword || ''} onChange={e => setDesignPassword(e.target.value)}/>
                      )}
                  </div>
              )}
            </div>

            <div className="flex gap-4 mt-6">
              <button onClick={() => { setIsUploadModalOpen(false); setIsEditModalOpen(false); }} className="flex-1 py-3 border rounded-lg font-bold">বাতিল</button>
              <button onClick={isEditModalOpen ? handleUpdate : handleUpload} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">সেভ করুন</button>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN/REGISTER FOR DOWNLOAD */}
      {showRegisterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white p-8 rounded-2xl w-full max-w-sm">
                  <h2 className="text-xl font-bold mb-2">রেজিস্ট্রেশন করুন</h2>
                  <p className="text-sm text-slate-500 mb-6">সোর্স ফাইল ডাউনলোড করতে আপনার নাম ও হোয়াটসঅ্যাপ নাম্বার দিন। (একবারই প্রয়োজন)</p>
                  <form onSubmit={handleUserRegister} className="space-y-4">
                      <input type="text" placeholder="আপনার নাম" className="w-full p-3 border rounded-lg" required value={registerInput.name || ''} onChange={e => setRegisterInput({...registerInput, name: e.target.value})}/>
                      <input type="text" placeholder="WhatsApp নাম্বার" className="w-full p-3 border rounded-lg" required value={registerInput.whatsapp || ''} onChange={e => setRegisterInput({...registerInput, whatsapp: e.target.value})}/>
                      <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold">জমা দিন</button>
                  </form>
                  <button onClick={() => setShowRegisterModal(false)} className="w-full mt-2 text-sm text-slate-400">পরে করবো</button>
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
            <button onClick={() => openSourceLink(selectedImage)} className={`flex gap-2 font-bold ${selectedImage.isLocked ? 'text-red-600' : 'text-indigo-600'}`}>{selectedImage.isLocked ? <Lock/> : <Unlock/>} সোর্স</button>
          </div>
        </div>
      )}
      
      {/* Existing Login/Settings/Delete Modals - Preserved */}
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
              {loginType === 'admin' && <input type="text" placeholder="ইউজারনেম" className="w-full p-3 border rounded-lg" value={loginInput.user || ''} onChange={e => setLoginInput({...loginInput, user: e.target.value})} />}
              <input type="password" placeholder="পাসওয়ার্ড" className="w-full p-3 border rounded-lg" value={loginInput.pass || ''} onChange={e => setLoginInput({...loginInput, pass: e.target.value})} />
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold">লগইন</button>
            </form>
          </div>
        </div>
      )}

      {isDeleteRequestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2 text-red-600">ডিলিট রিকোয়েস্ট পাঠান</h2>
            <textarea className="w-full p-3 border rounded-lg h-24 mb-4" placeholder="কেন ডিলিট করতে চান?" value={deleteReason || ''} onChange={e => setDeleteReason(e.target.value)}></textarea>
            <div className="flex gap-2">
              <button onClick={() => setIsDeleteRequestOpen(false)} className="flex-1 py-2 border rounded">বাতিল</button>
              <button onClick={submitDeleteRequest} className="flex-1 py-2 bg-red-600 text-white rounded font-bold">পাঠান</button>
            </div>
          </div>
        </div>
      )}
      
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md relative">
             <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Settings size={20}/> সেটিংস</h2>
             <textarea rows={4} className="w-full p-3 border rounded-xl" value={tempScriptUrl || ''} onChange={(e) => setTempScriptUrl(e.target.value)} placeholder="Google Web App URL..."/>
             <div className="mt-4 flex gap-2"><button onClick={() => setIsSettingsModalOpen(false)} className="flex-1 py-2 border rounded">বাতিল</button><button onClick={async () => { await setDoc(doc(db, "settings", "config"), { scriptUrl: tempScriptUrl }, { merge: true }); setIsSettingsModalOpen(false); alert("সেভ হয়েছে!"); }} className="flex-1 py-2 bg-indigo-600 text-white rounded font-bold">সেভ</button></div>
          </div>
        </div>
      )}

    </div>
  );
}

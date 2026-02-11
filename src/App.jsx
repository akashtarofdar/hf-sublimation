import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signOut
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
  query
} from 'firebase/firestore';
import { 
  Upload, 
  Search, 
  X, 
  Image as ImageIcon, 
  Loader2, 
  Maximize2,
  Lock,
  Unlock,
  Trash2,
  LogIn,
  LogOut,
  Save,
  Download,
  Palette,
  Filter,
  Pencil,
  Link,
  FileUp,
  CloudUpload,
  Settings,
  AlertCircle 
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
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Black', hex: '#1e293b' },
  { name: 'White', hex: '#f8fafc' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Cyan', hex: '#06b6d4' },
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

// Helper: Read file as Base64 (Old Google Drive Helper - Kept if needed later)
const readFileAsBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

export default function App() {
  // State Management
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passError, setPassError] = useState(false);
  const [authError, setAuthError] = useState(null);
  
  const [user, setUser] = useState(null);
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(''); 
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColorFilter, setSelectedColorFilter] = useState('All');
  
  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingDesign, setEditingDesign] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Settings State
  const [googleScriptUrl, setGoogleScriptUrl] = useState('');
  const [tempScriptUrl, setTempScriptUrl] = useState('');

  // Form State
  const [newDesignTitle, setNewDesignTitle] = useState('');
  const [newDesignTag, setNewDesignTag] = useState('Sublimation');
  const [newDesignColor, setNewDesignColor] = useState('Multicolor');
  const [sourceLink, setSourceLink] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  
  // Source File Upload State
  const [sourceFile, setSourceFile] = useState(null);
  const [useFileUpload, setUseFileUpload] = useState(false);

  const SITE_PASSWORD = '252746';

  // Auth Effect
  useEffect(() => {
    const login = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth Error:", err);
        if (err.code === 'auth/configuration-not-found') {
          setAuthError("Firebase Console-এ Anonymous Auth চালু করা নেই।");
        } else {
          setAuthError("সার্ভার কানেকশন এরর: " + err.message);
        }
        setLoading(false);
      }
    };
    login();
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setAuthError(null);
      }
    });
  }, []);

  // Firestore Data Fetching
  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, 'designs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setDesigns(items);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      if (err.code !== 'unavailable') { 
         setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Settings
  useEffect(() => {
    if (!user) return;
    
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const url = docSnap.data().scriptUrl || "";
          setGoogleScriptUrl(url);
          setTempScriptUrl(url);
        }
      } catch (err) {
        console.error("Settings Fetch Error:", err);
      }
    };
    fetchSettings();
  }, [user]);

  // Handlers
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === SITE_PASSWORD) {
      setIsAuthenticated(true);
      setPassError(false);
      setShowLoginModal(false);
      setPasswordInput('');
    } else {
      setPassError(true);
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  const handleDelete = async (e, designId) => {
    e.stopPropagation();
    if (!isAuthenticated) return;
    
    if (window.confirm("আপনি কি নিশ্চিত যে এই ডিজাইনটি ডিলিট করতে চান?")) {
      try {
        await deleteDoc(doc(db, 'designs', designId));
        if (selectedImage?.id === designId) setSelectedImage(null);
      } catch (err) {
        console.error("Delete Error:", err);
      }
    }
  };

  // --- SETTINGS HANDLERS ---
  const handleSaveSettings = async () => {
    if (!tempScriptUrl) return;
    try {
      await setDoc(doc(db, "settings", "config"), { scriptUrl: tempScriptUrl }, { merge: true });
      setGoogleScriptUrl(tempScriptUrl);
      setIsSettingsModalOpen(false);
      alert("সেটিংস আপডেট হয়েছে!");
    } catch (err) {
      console.error("Settings Save Error:", err);
      alert("সেভ করা সম্ভব হয়নি।");
    }
  };

  // --- EDIT HANDLERS ---
  const openEditModal = (e, design) => {
    e.stopPropagation();
    setEditingDesign(design);
    setNewDesignTitle(design.title);
    setNewDesignTag(design.tag);
    setNewDesignColor(design.color || 'Multicolor');
    setSourceLink(design.sourceLink || '');
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingDesign) return;
    setUploading(true);
    setUploadStatus('আপডেট হচ্ছে...');
    try {
      const designRef = doc(db, 'designs', editingDesign.id);
      await updateDoc(designRef, {
        title: newDesignTitle,
        tag: newDesignTag,
        color: newDesignColor,
        sourceLink: sourceLink
      });
      
      setIsEditModalOpen(false);
      setEditingDesign(null);
      resetForm();
    } catch (err) {
      console.error("Update Error:", err);
      alert("আপডেট সফল হয়নি।");
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  };

  // --- UPLOAD HANDLERS ---
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

  // --- NEW: Telegram Upload Function ---
  const uploadToTelegram = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    // আপনার রেন্ডার সার্ভারের লিংক
    const SERVER_URL = "https://private-link-sender.onrender.com/upload"; 

    try {
      const response = await fetch(SERVER_URL, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        return data.link; // বটের তৈরি করা সিক্রেট লিংক
      } else {
        throw new Error("Telegram Upload Failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Upload Error:", error);
      throw error;
    }
  };

  // Old Google Drive Upload (Kept as backup, but not used now)
  const uploadToGoogleDrive = async (file) => {
    if (!googleScriptUrl) {
      throw new Error("গুগল ড্রাইভ লিঙ্ক সেট করা নেই!");
    }
    const base64 = await readFileAsBase64(file);
    const response = await fetch(googleScriptUrl, {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        file: base64,
      }),
    });
    const result = await response.json();
    if (result.status === 'success') {
      return result.url;
    } else {
      throw new Error(result.message);
    }
  };

  const handleUpload = async () => {
    if (!fileToUpload || !newDesignTitle) {
      alert("ডিজাইনের নাম এবং প্রিভিউ ছবি দেওয়া বাধ্যতামূলক।");
      return;
    }
    if (!useFileUpload && !sourceLink) {
      alert("সোর্স লিঙ্ক দিন অথবা ফাইল আপলোড করুন।");
      return;
    }
    if (useFileUpload && !sourceFile) {
      alert("সোর্স ফাইল সিলেক্ট করুন।");
      return;
    }

    setUploading(true);
    try {
      let finalSourceLink = sourceLink;

      // যদি ইউজার ফাইল সিলেক্ট করে থাকে
      if (useFileUpload && sourceFile) {
        setUploadStatus('টেলিগ্রামে ফাইল আপলোড হচ্ছে... (একটু সময় দিন)');
        
        // --- পরিবর্তন: গুগল ড্রাইভের বদলে টেলিগ্রামে আপলোড ---
        finalSourceLink = await uploadToTelegram(sourceFile);
        console.log("Uploaded Link:", finalSourceLink);
      }

      setUploadStatus('প্রিভিউ ছবি প্রসেসিং হচ্ছে...');
      const compressedBase64 = await compressImage(fileToUpload);

      setUploadStatus('ডাটাবেসে সেভ হচ্ছে...');
      await addDoc(collection(db, 'designs'), {
        title: newDesignTitle,
        tag: newDesignTag,
        color: newDesignColor,
        imageData: compressedBase64,
        sourceLink: finalSourceLink,
        uploaderId: user.uid,
        createdAt: serverTimestamp(),
      });

      setIsUploadModalOpen(false);
      resetForm();
      alert("সফলভাবে আপলোড হয়েছে!");
    } catch (err) {
      console.error(err);
      alert(`আপলোড ব্যর্থ হয়েছে: ${err.message}`);
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  };

  const resetForm = () => {
    setFileToUpload(null);
    setPreviewUrl(null);
    setNewDesignTitle('');
    setSourceLink('');
    setNewDesignColor('Multicolor');
    setSourceFile(null);
    setUseFileUpload(false);
  };

  const openSourceLink = (link) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    const url = link.startsWith('http') ? link : `https://${link}`;
    window.open(url, '_blank');
  };

  // Image Download Function
  const downloadImageOnly = (e, imageData, title) => {
    e.stopPropagation();
    
    const img = new Image();
    img.src = imageData;
    img.crossOrigin = "anonymous"; 

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const fontSize = Math.max(24, Math.floor(img.width * 0.04)); 
      const padding = fontSize; 
      const footerHeight = fontSize + padding;

      canvas.width = img.width;
      canvas.height = img.height + footerHeight;

      ctx.drawImage(img, 0, 0);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, img.height, canvas.width, footerHeight);

      ctx.fillStyle = '#000000';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title || 'HF Sublimation Design', canvas.width / 2, img.height + (footerHeight / 2));

      const link = document.createElement('a');
      link.download = `${title || 'design'}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  };

  const filteredDesigns = useMemo(() => {
    return designs.filter(d => {
      const matchesSearch = 
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.tag.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesColor = selectedColorFilter === 'All' || d.color === selectedColorFilter;

      return matchesSearch && matchesColor;
    });
  }, [designs, searchQuery, selectedColorFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-4">
        {authError ? (
          <div className="text-center max-w-md p-6 bg-red-50 rounded-2xl border border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-red-700 mb-2">সেটআপ এরর</h3>
            <p className="text-red-600 text-sm">{authError}</p>
          </div>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
            <p className="text-slate-500 font-medium animate-pulse">লোড হচ্ছে...</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-indigo-100 selection:text-indigo-700">
      
      {authError && (
        <div className="bg-red-500 text-white text-center py-2 px-4 text-sm font-bold animate-pulse">
          {authError}
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-5 flex flex-col items-center gap-4">
          
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => {window.scrollTo(0, 0); setSelectedColorFilter('All'); setSearchQuery('');}}>
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="flex items-center gap-2">
                {isAuthenticated ? (
                <>
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

          {/* Color Filters */}
          <div className="w-full overflow-x-auto pb-1 no-scrollbar flex items-center gap-2">
            <div className="flex items-center gap-1 text-slate-400 text-xs font-bold uppercase mr-2 shrink-0">
               <Filter size={14} /> ফিল্টার:
            </div>
            <button 
              onClick={() => setSelectedColorFilter('All')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all shrink-0 ${selectedColorFilter === 'All' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              সব ডিজাইন
            </button>
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
                <span 
                  className="w-3 h-3 rounded-full border border-black/10" 
                  style={{ background: c.hex }}
                ></span>
                {c.name}
              </button>
            ))}
          </div>

        </div>
      </header>

      {/* --- MAIN GRID --- */}
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {filteredDesigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm mt-8">
            <div className="bg-slate-50 p-4 rounded-full mb-4">
               <Search size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">এই ক্যাটাগরিতে কোনো ডিজাইন নেই</p>
            {selectedColorFilter !== 'All' && (
               <button onClick={() => setSelectedColorFilter('All')} className="text-indigo-600 text-sm font-bold mt-2 hover:underline">
                  সব ডিজাইন দেখুন
               </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {filteredDesigns.map(design => (
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
                      
                      {isAuthenticated && (
                        <div className="flex gap-1 -mt-1 -mr-2">
                         {/* Edit Button */}
                         <button 
                            onClick={(e) => openEditModal(e, design)} 
                            className="text-slate-300 hover:text-indigo-500 transition-colors p-1"
                            title="এডিট করুন"
                         >
                            <Pencil size={16} />
                         </button>
                         {/* Delete Button */}
                         <button 
                            onClick={(e) => handleDelete(e, design.id)} 
                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                            title="ডিলিট করুন"
                         >
                            <Trash2 size={16} />
                         </button>
                        </div>
                      )}
                  </div>
                  
                  <div className={`mt-auto grid gap-3 ${isAuthenticated ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <button 
                      onClick={(e) => downloadImageOnly(e, design.imageData, design.title)}
                      className="bg-slate-50 text-slate-600 border border-slate-200 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-100 hover:text-indigo-600 hover:border-indigo-100 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Download size={14} /> ছবি সেভ
                    </button>

                    {isAuthenticated && (
                      <button 
                        onClick={() => openSourceLink(design.sourceLink)}
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
        )}
      </main>

      {/* --- LOGIN MODAL --- */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowLoginModal(false)}></div>
            <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center relative z-10 animate-[scaleIn_0.2s_ease-out]">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5 rotate-3">
              <Lock className="text-indigo-600" size={28} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">অ্যাডমিন এক্সেস</h2>
            <p className="text-slate-500 text-sm mb-8 px-4">পাসওয়ার্ড দিন।</p>
            
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                 <input 
                   type="password"
                   autoFocus
                   value={passwordInput}
                   onChange={(e) => setPasswordInput(e.target.value)}
                   placeholder="পাসওয়ার্ড লিখুন"
                   className={`w-full p-4 text-center text-lg tracking-widest border rounded-xl focus:ring-4 outline-none transition-all ${
                     passError 
                       ? 'border-red-200 focus:ring-red-100 bg-red-50 text-red-600 placeholder:text-red-300' 
                       : 'border-slate-200 focus:ring-indigo-100 focus:border-indigo-400 bg-slate-50'
                   }`}
                 />
              </div>
              {passError && <p className="text-red-500 text-xs font-bold animate-bounce">ভুল পাসওয়ার্ড!</p>}
              
              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-200 transition-all active:scale-[0.98] text-base"
              >
                আনলক করুন
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- SETTINGS MODAL --- */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSettingsModalOpen(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden relative z-10 shadow-2xl animate-[fadeIn_0.3s_ease-out]">
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
                     value={tempScriptUrl}
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

      {/* --- UPLOAD MODAL --- */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsUploadModalOpen(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden relative z-10 shadow-2xl animate-[fadeIn_0.3s_ease-out]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="font-bold text-lg text-slate-800">নতুন ডিজাইন আপলোড</h2>
              <button className="bg-slate-100 p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors" onClick={() => setIsUploadModalOpen(false)}>
                 <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              
              {/* Image Uploader */}
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all relative group cursor-pointer">
                <input type="file" accept="image/*" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                
                {previewUrl ? (
                  <div className="relative inline-block">
                     <img src={previewUrl} className="h-48 mx-auto rounded-lg shadow-sm object-contain bg-white" alt="Preview" />
                     <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <p className="text-white text-xs font-bold bg-black/50 px-3 py-1 rounded-full">ছবি পরিবর্তন করুন</p>
                     </div>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center">
                    <div className="bg-indigo-50 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
                       <Upload size={24} className="text-indigo-500" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">ডিজাইনের ছবি (JPG/PNG)</span>
                    <span className="text-xs text-slate-400 mt-1">এখানে ড্রপ করুন বা ক্লিক করুন</span>
                  </div>
                )}
              </div>

              {/* Name Input */}
              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">নাম</label>
                 <input type="text" placeholder="ডিজাইনের নাম..." className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" value={newDesignTitle} onChange={e => setNewDesignTitle(e.target.value)} />
              </div>

              {/* Source File Section (Toggle) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                   <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      {useFileUpload ? <CloudUpload size={14}/> : <Link size={14}/>} সোর্স ফাইল
                   </label>
                   <button 
                      onClick={() => setUseFileUpload(!useFileUpload)} 
                      className="text-[10px] font-bold text-indigo-600 hover:underline bg-white px-2 py-1 rounded border border-indigo-100"
                   >
                      {useFileUpload ? 'লিঙ্ক ব্যবহার করুন' : 'ফাইল আপলোড করুন'}
                   </button>
                </div>

                {useFileUpload ? (
                   <div className="relative">
                      <input 
                         type="file" 
                         onChange={handleSourceFileSelect}
                         className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                      />
                      <p className="text-[10px] text-slate-400 mt-2 italic">* টেলিগ্রাম বটের মাধ্যমে ২ জিবি পর্যন্ত ফাইল আপলোড করতে পারবেন।</p>
                   </div>
                ) : (
                   <input type="text" placeholder="Drive / Dropbox Link..." className="w-full p-3 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-mono text-indigo-600" value={sourceLink} onChange={e => setSourceLink(e.target.value)} />
                )}
              </div>

              {/* Color & Category */}
              <div className="flex gap-4 overflow-x-auto pb-2">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-2 block flex items-center gap-1"><Palette size={12}/> কালার</label>
                    <div className="flex flex-wrap gap-2 w-40">
                       {COLORS.map((c) => (
                         <button 
                           key={c.name} onClick={() => setNewDesignColor(c.name)}
                           className={`w-6 h-6 rounded-full border shadow-sm ${newDesignColor === c.name ? 'ring-2 ring-indigo-500 scale-110 border-white' : 'border-slate-200'}`}
                           style={{ background: c.hex }} title={c.name}
                         />
                       ))}
                    </div>
                 </div>
                 <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-2 block">ক্যাটাগরি</label>
                    <div className="flex flex-wrap gap-2">
                      {['Sublimation', 'Full Sleeve', 'Collar', 'Half Sleeve', 'Shorts', 'Pattern'].map(t => (
                        <button key={t} onClick={() => setNewDesignTag(t)} className={`px-2 py-1 rounded text-[10px] font-bold border ${newDesignTag === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{t}</button>
                      ))}
                    </div>
                 </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button onClick={() => setIsUploadModalOpen(false)} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white font-bold transition-colors">বাতিল</button>
              <button onClick={handleUpload} disabled={uploading} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 font-bold hover:bg-indigo-700 shadow-lg">
                {uploading ? <Loader2 className="animate-spin" size={20} /> : 'আপলোড নিশ্চিত করুন'}
              </button>
            </div>
            {uploadStatus && <div className="absolute inset-x-0 bottom-0 bg-indigo-600 text-white text-xs font-bold text-center py-1 animate-pulse">{uploadStatus}</div>}
          </div>
        </div>
      )}

      {/* --- EDIT MODAL (FOR OLD DESIGNS) --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden relative z-10 shadow-2xl animate-[fadeIn_0.3s_ease-out]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                 <Pencil size={18} className="text-indigo-600"/> এডিট ডিজাইন
              </h2>
              <button className="bg-slate-100 p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors" onClick={() => setIsEditModalOpen(false)}>
                 <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="flex justify-center mb-4">
                  <img src={editingDesign?.imageData} alt="Preview" className="h-32 object-contain rounded-lg shadow-sm border border-slate-200" />
              </div>

              <div className="space-y-3">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">নাম</label>
                    <input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" value={newDesignTitle} onChange={e => setNewDesignTitle(e.target.value)} />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">লিঙ্ক</label>
                    <input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-mono text-indigo-600" value={sourceLink} onChange={e => setSourceLink(e.target.value)} />
                 </div>
              </div>

              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-2 block flex items-center gap-1"><Palette size={12}/> কালার আপডেট করুন</label>
                 <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button 
                        key={c.name} onClick={() => setNewDesignColor(c.name)}
                        className={`w-8 h-8 rounded-full border-2 transition-all shadow-sm ${newDesignColor === c.name ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110 border-white' : 'border-slate-100 hover:scale-110'}`}
                        style={{ background: c.hex }} title={c.name}
                      />
                    ))}
                 </div>
              </div>

              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-2 block">ক্যাটাগরি</label>
                 <div className="flex flex-wrap gap-2">
                   {['Sublimation', 'Full Sleeve', 'Collar', 'Half Sleeve', 'Shorts', 'Pattern'].map(t => (
                     <button key={t} onClick={() => setNewDesignTag(t)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${newDesignTag === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{t}</button>
                   ))}
                 </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white font-bold transition-colors">বাতিল</button>
              <button onClick={handleUpdate} disabled={uploading} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 font-bold hover:bg-indigo-700 shadow-lg">
                {uploading ? <Loader2 className="animate-spin" size={20} /> : 'সেভ করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FULL IMAGE PREVIEW --- */}
      {selectedImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 animate-[fadeIn_0.2s_ease-out]">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setSelectedImage(null)}></div>
          <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 z-50 bg-white/10 text-white p-2 rounded-full hover:bg-white/20 transition-all"><X size={24} /></button>
          
          <div className="relative w-full max-w-5xl h-full max-h-[90vh] flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
             <img src={selectedImage.imageData} className="w-full h-full object-contain rounded-lg shadow-2xl" alt="Full View" />
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl flex items-center gap-4 border border-white/20">
                <h3 className="text-slate-800 font-bold mr-2 hidden sm:block">{selectedImage.title}</h3>
                {isAuthenticated && <div className="h-6 w-px bg-slate-300 hidden sm:block"></div>}
                <button onClick={(e) => downloadImageOnly(e, selectedImage.imageData, selectedImage.title)} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 flex items-center gap-2 text-sm transition-colors"><Download size={16} /> <span className="hidden sm:inline">সেভ</span></button>
                {isAuthenticated && (<button onClick={() => openSourceLink(selectedImage.sourceLink)} className="px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition-colors text-white bg-indigo-600 hover:bg-indigo-700"><Unlock size={16} /> AI ফাইল</button>)}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  handleFirestoreError,
  OperationType
} from './firebase';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  LogOut, 
  User as UserIcon, 
  ShieldCheck, 
  History,
  ChevronRight,
  Plus,
  Lock,
  Zap, 
  Wifi, 
  Activity, 
  QrCode 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface Transaction {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  timestamp: any;
}

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  balance: number;
  points: number;
  creditScore: number;
  pin?: string;
  createdAt: any;
}

// --- Components ---

const PinPad = ({ onComplete, onCancel }: { onComplete: (pin: string) => void; onCancel?: () => void }) => {
  const [pin, setPin] = useState('');
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'clear'];

  const handlePress = (digit: string) => {
    if (digit === 'clear') {
      setPin('');
    } else if (digit === '') {
      return;
    } else if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(() => onComplete(newPin), 200);
      }
    }
  };

  return (
    <div className="flex flex-col items-center space-y-8">
      <div className="flex space-x-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 border-primary transition-all duration-200 ${
              pin.length > i ? 'bg-primary scale-110' : 'bg-transparent'
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {digits.map((digit, i) => (
          <button
            key={i}
            onClick={() => handlePress(digit)}
            disabled={digit === ''}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold transition-all active:scale-90 ${
              digit === '' ? 'invisible' : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
            } ${digit === 'clear' ? 'text-sm uppercase' : ''}`}
          >
            {digit === 'clear' ? 'C' : digit}
          </button>
        ))}
      </div>
      {onCancel && (
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      )}
    </div>
  );
};

const LoginScreen = ({ onLogin }: { onLogin: (user: any) => void }) => {
  const [step, setStep] = useState<'auth' | 'pin'>('auth');
  const [tempUser, setTempUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    
    // Detect Electron environment
    const isElectron = navigator.userAgent.includes('Electron');
    
    try {
      if (isElectron) {
        console.log('Electron detected. Attempting login...');
      }

      let user = auth.currentUser;
      if (!user) {
        const result = await signInWithPopup(auth, googleProvider);
        user = result.user;
      }
      
      if (!user) throw new Error('No user found after login attempt.');

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const data = userDoc.data() as UserData;
        if (data.pin) {
          setTempUser(data);
          setStep('pin');
        } else {
          onLogin(data);
        }
      } else {
        // New user - create profile
        const newData: UserData = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'User',
          photoURL: user.photoURL || '',
          balance: 1000, // Initial bonus
          points: 0,
          creditScore: 720, // Starting score
          createdAt: new Date(),
        };
        await setDoc(doc(db, 'users', user.uid), newData);
        onLogin(newData);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return;
      }
      if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Google Login. Please add it in Firebase Console.');
      } else if (err.code === 'auth/operation-not-supported-in-this-environment') {
        setError('Google Login is not supported in this environment (likely Electron). Please use the web version or check configuration.');
      } else {
        setError(err.message || 'Failed to login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePinComplete = (pin: string) => {
    if (tempUser && tempUser.pin === pin) {
      onLogin(tempUser);
    } else {
      setError('Invalid PIN. Please try again.');
      // Reset after a delay
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card p-8 rounded-3xl shadow-2xl border border-border"
      >
        <div className="flex flex-col items-center mb-12">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <Wallet className="text-primary-foreground w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Nexus Bank</h1>
          <p className="text-muted-foreground text-center mt-2">
            {step === 'auth' ? 'Secure your future with modern banking' : 'Enter your secure PIN'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-destructive/10 text-destructive text-sm rounded-lg text-center">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'auth' ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className={`w-full flex items-center justify-center space-x-3 bg-foreground text-background py-4 rounded-xl font-semibold transition-all active:scale-[0.98] ${
                  loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                ) : (
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                )}
                <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
              </button>
              <p className="text-xs text-center text-muted-foreground px-8">
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <PinPad onComplete={handlePinComplete} onCancel={() => setStep('auth')} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

const Dashboard = ({ user, onLogout }: { user: UserData; onLogout: () => void }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPinSetup, setShowPinSetup] = useState(!user.pin);
  const [showTransferModal, setShowTransferModal] = useState<'add' | 'send' | 'pay' | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [showBillsModal, setShowBillsModal] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const bills = [
    { id: '1', name: 'Electricity Bill', amount: 85.50, dueDate: 'Apr 12', icon: <Zap className="text-yellow-500" /> },
    { id: '2', name: 'Internet Subscription', amount: 59.99, dueDate: 'Apr 15', icon: <Wifi className="text-blue-500" /> },
    { id: '3', name: 'Gym Membership', amount: 45.00, dueDate: 'Apr 20', icon: <Activity className="text-emerald-500" /> },
  ];

  useEffect(() => {
    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/transactions`);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handleSetPin = async (pin: string) => {
    try {
      await setDoc(doc(db, 'users', user.uid), { pin }, { merge: true });
      setShowPinSetup(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransaction = async () => {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) return;
    if ((showTransferModal === 'send' || showTransferModal === 'pay') && amount > user.balance) {
      alert('Insufficient balance');
      return;
    }

    setIsProcessing(true);
    try {
      const isCredit = showTransferModal === 'add';
      const newBalance = isCredit ? user.balance + amount : user.balance - amount;
      const newPoints = user.points + Math.floor(amount / 10); // 1 point per $10
      
      // Update User
      await setDoc(doc(db, 'users', user.uid), { 
        balance: newBalance,
        points: newPoints
      }, { merge: true });

      // Add Transaction
      const txRef = collection(db, 'users', user.uid, 'transactions');
      await setDoc(doc(txRef, crypto.randomUUID()), {
        userId: user.uid,
        amount: amount,
        type: isCredit ? 'credit' : 'debit',
        description: transferDesc || (showTransferModal === 'add' ? 'Deposit' : showTransferModal === 'pay' ? 'Bill Payment' : 'Transfer'),
        timestamp: new Date()
      });

      setShowTransferModal(null);
      setTransferAmount('');
      setTransferDesc('');
    } catch (err) {
      console.error(err);
      alert('Transaction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const payBill = (bill: any) => {
    setTransferAmount(bill.amount.toString());
    setTransferDesc(bill.name);
    setShowTransferModal('pay');
    setShowBillsModal(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="p-6 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-border">
            <img src={user.photoURL || 'https://picsum.photos/seed/user/100/100'} alt={user.displayName} referrerPolicy="no-referrer" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Welcome back,</p>
            <p className="font-semibold">{user.displayName}</p>
          </div>
        </div>
        <button onClick={onLogout} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-8">
        {/* Balance Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-primary text-primary-foreground p-8 rounded-[2.5rem] shadow-2xl shadow-primary/20 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Wallet size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-2">
              <p className="text-primary-foreground/70 text-sm font-medium">Total Balance</p>
              <div className="bg-white/20 px-3 py-1 rounded-full flex items-center space-x-1">
                <ShieldCheck size={14} />
                <span className="text-xs font-bold">Nexus Points: {user.points}</span>
              </div>
            </div>
            <h2 className="text-5xl font-bold tracking-tight mb-8">
              ${user.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h2>
            <div className="flex space-x-4">
              <button 
                onClick={() => setShowTransferModal('add')}
                className="flex-1 bg-white/20 backdrop-blur-md py-3 rounded-2xl flex items-center justify-center space-x-2 hover:bg-white/30 transition-all"
              >
                <Plus size={18} />
                <span className="font-semibold">Add Money</span>
              </button>
              <button 
                onClick={() => setShowTransferModal('send')}
                className="flex-1 bg-white/20 backdrop-blur-md py-3 rounded-2xl flex items-center justify-center space-x-2 hover:bg-white/30 transition-all"
              >
                <ArrowUpRight size={18} />
                <span className="font-semibold">Send</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Credit Score Gauge */}
        <div className="bg-card p-6 rounded-3xl border border-border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Credit Score</h3>
            <span className="text-emerald-500 text-sm font-bold">Excellent</span>
          </div>
          <div className="relative h-4 bg-secondary rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${((user.creditScore - 300) / (850 - 300)) * 100}%` }}
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-500 via-yellow-500 to-emerald-500"
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            <span>300</span>
            <span className="text-foreground text-lg font-bold">{user.creditScore}</span>
            <span>850</span>
          </div>
        </div>

        {/* PIN Setup Alert */}
        {showPinSetup && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-accent p-6 rounded-3xl border border-border flex items-center justify-between"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <Lock size={24} />
              </div>
              <div>
                <p className="font-semibold">Secure your account</p>
                <p className="text-sm text-muted-foreground">Setup a visual PIN for extra security</p>
              </div>
            </div>
            <button 
              onClick={() => setShowPinSetup(true)} 
              className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold"
            >
              Setup
            </button>
          </motion.div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: <ArrowDownLeft />, label: 'Receive', color: 'bg-emerald-500/10 text-emerald-600', onClick: () => setShowReceiveModal(true) },
            { icon: <ArrowUpRight />, label: 'Pay', color: 'bg-blue-500/10 text-blue-600', onClick: () => setShowTransferModal('pay') },
            { icon: <CreditCard />, label: 'Cards', color: 'bg-purple-500/10 text-purple-600', onClick: () => setShowCardsModal(true) },
            { icon: <History />, label: 'Bills', color: 'bg-orange-500/10 text-orange-600', onClick: () => setShowBillsModal(true) },
          ].map((action, i) => (
            <div key={i} className="flex flex-col items-center space-y-2">
              <button 
                onClick={action.onClick}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${action.color} transition-transform active:scale-90`}
              >
                {action.icon}
              </button>
              <span className="text-xs font-medium text-muted-foreground">{action.label}</span>
            </div>
          ))}
        </div>

        {/* Transactions */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Recent Transactions</h3>
            <button 
              onClick={() => setShowAllTransactions(true)}
              className="text-sm text-primary font-semibold flex items-center"
            >
              See All <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : transactions.length > 0 ? (
              transactions.map((tx) => (
                <div key={tx.id} className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between hover:bg-accent/50 transition-colors cursor-pointer">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      tx.type === 'credit' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {tx.type === 'credit' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                    </div>
                    <div>
                      <p className="font-semibold">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.timestamp?.toDate().toLocaleDateString() || 'Just now'}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-foreground'}`}>
                    {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-accent/30 rounded-3xl border border-dashed border-border">
                <History className="mx-auto text-muted-foreground mb-2" size={32} />
                <p className="text-muted-foreground">No transactions yet</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* PIN Setup Modal */}
      <AnimatePresence>
        {showPinSetup && user.pin === undefined && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-card p-8 rounded-[2.5rem] shadow-2xl border border-border w-full max-w-sm"
            >
              <h2 className="text-2xl font-bold text-center mb-2">Create Security PIN</h2>
              <p className="text-muted-foreground text-center mb-8 text-sm">Choose a 4-digit code for visual authentication</p>
              <PinPad onComplete={handleSetPin} />
            </motion.div>
          </motion.div>
        )}

        {showTransferModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-card p-8 rounded-[2.5rem] shadow-2xl border border-border w-full max-w-sm"
            >
              <h2 className="text-2xl font-bold text-center mb-2">
                {showTransferModal === 'add' ? 'Add Money' : showTransferModal === 'pay' ? 'Pay Bill' : 'Send Money'}
              </h2>
              <p className="text-muted-foreground text-center mb-8 text-sm">
                {showTransferModal === 'add' ? 'Deposit funds into your account' : 'Securely transfer funds from your balance'}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 block">Amount</label>
                  <input 
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-secondary p-4 rounded-2xl text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 block">Description</label>
                  <input 
                    type="text"
                    value={transferDesc}
                    onChange={(e) => setTransferDesc(e.target.value)}
                    placeholder="What's this for?"
                    className="w-full bg-secondary p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex space-x-3 pt-4">
                  <button 
                    onClick={() => setShowTransferModal(null)}
                    className="flex-1 py-4 rounded-2xl font-bold text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleTransaction}
                    disabled={isProcessing || !transferAmount}
                    className="flex-1 py-4 rounded-2xl font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showReceiveModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-card p-8 rounded-[2.5rem] shadow-2xl border border-border w-full max-w-sm text-center"
            >
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-white rounded-3xl border-4 border-primary/10">
                  <QrCode size={200} className="text-primary" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">My QR Code</h2>
              <p className="text-muted-foreground text-sm mb-6">Scan this code to send money to {user.displayName}</p>
              <div className="bg-secondary p-4 rounded-2xl text-left mb-6">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Account Number</p>
                <p className="font-mono font-bold">NX-8829-1029-4491</p>
              </div>
              <button 
                onClick={() => setShowReceiveModal(false)}
                className="w-full py-4 rounded-2xl font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}

        {showCardsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-card p-8 rounded-[2.5rem] shadow-2xl border border-border w-full max-w-sm"
            >
              <h2 className="text-2xl font-bold mb-6">My Cards</h2>
              <div className="space-y-4 mb-8">
                <div className="bg-gradient-to-br from-zinc-800 to-black p-6 rounded-3xl text-white aspect-[1.6/1] flex flex-col justify-between shadow-xl">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-8 bg-yellow-500/20 rounded-md border border-yellow-500/40" />
                    <Wifi size={20} className="rotate-90 opacity-50" />
                  </div>
                  <div>
                    <p className="text-lg font-mono tracking-widest mb-2">•••• •••• •••• 4491</p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[8px] uppercase opacity-50 font-bold">Card Holder</p>
                        <p className="text-sm font-semibold uppercase">{user.displayName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] uppercase opacity-50 font-bold">Expires</p>
                        <p className="text-sm font-semibold">12/28</p>
                      </div>
                    </div>
                  </div>
                </div>
                <button className="w-full py-4 rounded-2xl border-2 border-dashed border-border text-muted-foreground font-semibold flex items-center justify-center space-x-2 hover:bg-secondary transition-colors">
                  <Plus size={18} />
                  <span>Add New Card</span>
                </button>
              </div>
              <button 
                onClick={() => setShowCardsModal(false)}
                className="w-full py-4 rounded-2xl font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}

        {showBillsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-card p-8 rounded-[2.5rem] shadow-2xl border border-border w-full max-w-sm"
            >
              <h2 className="text-2xl font-bold mb-6">Upcoming Bills</h2>
              <div className="space-y-4 mb-8">
                {bills.map(bill => (
                  <div key={bill.id} className="flex items-center justify-between p-4 bg-secondary rounded-2xl">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center">
                        {bill.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{bill.name}</p>
                        <p className="text-xs text-muted-foreground">Due {bill.dueDate}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">${bill.amount.toFixed(2)}</p>
                      <button 
                        onClick={() => payBill(bill)}
                        className="text-[10px] font-bold text-primary uppercase tracking-widest"
                      >
                        Pay Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setShowBillsModal(false)}
                className="w-full py-4 rounded-2xl font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}

        {showAllTransactions && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background z-50 flex flex-col"
          >
            <header className="p-6 flex items-center justify-between border-b border-border">
              <button onClick={() => setShowAllTransactions(false)} className="p-2 -ml-2">
                <ChevronRight size={24} className="rotate-180" />
              </button>
              <h2 className="text-xl font-bold">All Transactions</h2>
              <div className="w-10" />
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {transactions.length > 0 ? (
                transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-card rounded-2xl border border-border">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        tx.type === 'credit' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                      }`}>
                        {tx.type === 'credit' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                      </div>
                      <div>
                        <p className="font-semibold">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleDateString() : new Date(tx.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p className={`font-bold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-foreground'}`}>
                      {tx.type === 'credit' ? '+' : '-'}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No transactions yet
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as UserData);
          } else {
            // User is logged in but no profile exists yet. 
            // This could happen if they closed the app during registration.
            // We'll set a minimal user state to allow the app to function or trigger creation.
            console.log('User logged in but no Firestore profile found.');
            // We don't set user here to avoid showing dashboard without data,
            // but we stop loading so LoginScreen can handle it.
            setUser(null);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLogin={setUser} />
      )}
    </div>
  );
}

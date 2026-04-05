
import { useState, useEffect } from 'react';
import {
 collection,
 doc,
 onSnapshot,
 setDoc,
 query,
 orderBy,
 limit,
 writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';

export const useInterviewData = (user: any) => {
 const [history, setHistory] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
   if (!user) {
     setHistory([]);
     setLoading(false);
     return;
   }

   const uid = user.uid;
   const historyQuery = query(
     collection(db, `users/${uid}/interviews`),
     orderBy('createdAt', 'desc'),
     limit(20)
   );

   const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
     const fetchedHistory = snapshot.docs.map(doc => ({
       id: doc.id,
       ...doc.data()
     }));
     setHistory(fetchedHistory);
     setLoading(false);
   }, (error) => {
     console.error("Error fetching interview history:", error);
     setLoading(false);
   });

   return () => unsubscribe();
 }, [user]);

 const saveInterview = async (data: any) => {
   if (!user) return;
   const id = Math.random().toString(36).substr(2, 9);
   await setDoc(doc(db, `users/${user.uid}/interviews/${id}`), {
     ...data,
     createdAt: new Date().toISOString()
   });
 };

 const clearAllData = async () => {
   if (!user) return;
   const { getDocs } = await import('firebase/firestore');
   const batch = writeBatch(db);
   const snapshot = await getDocs(collection(db, `users/${user.uid}/interviews`));
   snapshot.docs.forEach(d => batch.delete(d.ref));
   await batch.commit();
 };

 return {
   history,
   loading,
   saveInterview,
   clearAllData
 };
};


import { useState, useEffect } from 'react';
import {
 collection,
 doc,
 onSnapshot,
 setDoc,
 updateDoc,
 deleteDoc,
 query,
 orderBy,
 writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { Candidate, JDAnalysis } from '../../types';

export const useRecruiterData = (user: any) => {
 const [candidates, setCandidates] = useState<Candidate[]>([]);
 const [currentJD, setCurrentJD] = useState<{jd: string, analysis: JDAnalysis} | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
   if (!user) {
     setCandidates([]);
     setCurrentJD(null);
     setLoading(false);
     return;
   }

   const uid = user.uid;
   
   // Listen to candidates
   const candidatesQuery = query(
     collection(db, `users/${uid}/candidates`),
     orderBy('createdAt', 'desc')
   );

   const unsubscribeCandidates = onSnapshot(candidatesQuery, (snapshot) => {
     const fetchedCandidates = snapshot.docs.map(doc => {
       const data = doc.data();
       return {
         ...data,
         id: doc.id,
         file: null 
       } as Candidate;
     }).filter(c => !c.isHistory);
     setCandidates(fetchedCandidates);
   }, (error) => {
     console.error("Error fetching candidates:", error);
   });

   // Listen to current JD
   const jdUnsubscribe = onSnapshot(doc(db, `users/${uid}/jdAnalyses/current`), (doc) => {
     if (doc.exists()) {
       const data = doc.data();
       setCurrentJD({ jd: data.jd, analysis: data.analysis });
     } else {
       setCurrentJD(null);
     }
     setLoading(false);
   }, (error) => {
     console.error("Error fetching JD analysis:", error);
     setLoading(false);
   });

   return () => {
     unsubscribeCandidates();
     jdUnsubscribe();
   };
 }, [user]);

 const saveCandidate = async (candidate: Candidate) => {
   if (!user) return;
   const { file, ...serializableCandidate } = candidate;
   const data = {
     ...serializableCandidate,
     createdAt: candidate.createdAt || new Date().toISOString(),
     updatedAt: new Date().toISOString()
   };
   await setDoc(doc(db, `users/${user.uid}/candidates/${candidate.id}`), data);
 };

 const deleteCandidate = async (id: string) => {
   if (!user) return;
   await deleteDoc(doc(db, `users/${user.uid}/candidates/${id}`));
 };

 const saveJDAnalysis = async (jd: string, analysis: JDAnalysis) => {
   if (!user) return;
   await setDoc(doc(db, `users/${user.uid}/jdAnalyses/current`), {
     jd,
     analysis,
     updatedAt: new Date().toISOString()
   });
 };

 const archiveAllCandidates = async () => {
   if (!user) return;
   const uid = user.uid;
   const { getDocs } = await import('firebase/firestore');
   
   const batch = writeBatch(db);
   const snapshot = await getDocs(collection(db, `users/${uid}/candidates`));
   snapshot.docs.forEach(d => {
     batch.delete(doc(db, `users/${uid}/candidates/${d.id}`));
   });
   
   // Clear JD analysis
   batch.delete(doc(db, `users/${uid}/jdAnalyses/current`));
   
   await batch.commit();
 };

 const clearAllData = archiveAllCandidates;

 return {
   candidates,
   currentJD,
   loading,
   saveCandidate,
   deleteCandidate,
   saveJDAnalysis,
   archiveAllCandidates,
   clearAllData
 };
};


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
import { Candidate, JDAnalysis, Project } from '../../types';

export const useRecruiterData = (user: any) => {
 const [candidates, setCandidates] = useState<Candidate[]>([]);
 const [history, setHistory] = useState<Candidate[]>([]);
 const [currentJD, setCurrentJD] = useState<{jd: string, analysis: JDAnalysis} | null>(null);
 const [projects, setProjects] = useState<Project[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
   if (!user) {
     setCandidates([]);
     setHistory([]);
     setCurrentJD(null);
     setLoading(false);
     return;
   }

   const uid = user.uid;
   
   // Listen to candidates
   const candidatesQuery = query(
     collection(db, `users/${uid}/candidates`),
     orderBy('createdAt', 'asc')
   );

   const unsubscribeCandidates = onSnapshot(candidatesQuery, (snapshot) => {
     const fetchedCandidates = snapshot.docs.map(doc => {
       const data = doc.data();
       return {
         ...data,
         id: doc.id,
         file: null 
       } as Candidate;
     });
     
     setCandidates(fetchedCandidates.filter(c => !c.isHistory));
     setHistory(fetchedCandidates.filter(c => c.isHistory).slice(0, 20));
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

   // Listen to projects
   const projectsQuery = query(
     collection(db, `users/${uid}/projects`),
     orderBy('updatedAt', 'desc')
   );

   const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
     const fetchedProjects = snapshot.docs.map(doc => ({
       ...doc.data(),
       id: doc.id
     })) as Project[];
     setProjects(fetchedProjects);
   });

   return () => {
     unsubscribeCandidates();
     jdUnsubscribe();
     unsubscribeProjects();
   };
 }, [user]);

 const saveCandidate = async (candidate: Candidate) => {
   if (!user) return;
   const { file, ...serializableCandidate } = candidate;
   const data = {
     ...serializableCandidate,
     createdAt: candidate.createdAt || new Date().toISOString(),
     updatedAt: new Date().toISOString(),
     isShortlisted: candidate.isShortlisted || false
   };
   await setDoc(doc(db, `users/${user.uid}/candidates/${candidate.id}`), data);
 };

 const toggleShortlist = async (id: string) => {
   if (!user) return;
   const cand = candidates.find(c => c.id === id);
   if (!cand) return;
   await updateDoc(doc(db, `users/${user.uid}/candidates/${id}`), {
     isShortlisted: !cand.isShortlisted,
     updatedAt: new Date().toISOString()
   });
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

 const saveProject = async (project: Omit<Project, 'id'>) => {
   if (!user) return null;
   const id = Date.now().toString();
   await setDoc(doc(db, `users/${user.uid}/projects/${id}`), {
     ...project,
     id,
     updatedAt: new Date().toISOString()
   });
   return id;
 };

 const updateProject = async (id: string, data: Partial<Project>) => {
   if (!user) return;
   await updateDoc(doc(db, `users/${user.uid}/projects/${id}`), {
     ...data,
     updatedAt: new Date().toISOString()
   });
 };

 const deleteProject = async (id: string) => {
   if (!user) return;
   await deleteDoc(doc(db, `users/${user.uid}/projects/${id}`));
 };

 const archiveAllCandidates = async () => {
   if (!user) return;
   const uid = user.uid;
   const { getDocs } = await import('firebase/firestore');
   
   const batch = writeBatch(db);
   const snapshot = await getDocs(collection(db, `users/${uid}/candidates`));
   snapshot.docs.forEach(d => {
     batch.update(d.ref, {
       isHistory: true,
       updatedAt: new Date().toISOString()
     });
   });
   
   // Clear JD analysis
   batch.delete(doc(db, `users/${uid}/jdAnalyses/current`));
   
   await batch.commit();
 };

 const clearAllData = archiveAllCandidates;

 return {
   candidates,
   history,
   currentJD,
   projects,
   loading,
   saveCandidate,
   deleteCandidate,
   saveJDAnalysis,
   toggleShortlist,
   saveProject,
   updateProject,
   deleteProject,
   archiveAllCandidates,
   clearAllData
 };
};

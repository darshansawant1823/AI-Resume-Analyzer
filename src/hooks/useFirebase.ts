
import { useState, useEffect } from 'react';
import {
 doc,
 onSnapshot,
 setDoc,
 updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface ResumeEntry {
  id: string;
  name: string;
  text: string;
  uploadedAt: string;
}

export interface UserProfile {
  fullName: string;
  jobRole: string;
  experience: string;
  email: string;
  phoneNumber?: string;
  role: 'jobseeker' | 'recruiter' | 'admin';
  timeSpentMinutes?: number;
  createdAt?: string;
  lastResumeText?: string;
  lastResumeName?: string;
  resumes?: ResumeEntry[];
}

export const useFirestoreSync = (user: any) => {
 const [profile, setProfile] = useState<UserProfile | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
   if (!user) {
     setProfile(null);
     setLoading(false);
     return;
   }

   const uid = user.uid;
   const profileRef = doc(db, `users/${uid}`);

   const unsubscribe = onSnapshot(profileRef, (snapshot) => {
     if (snapshot.exists()) {
       setProfile(snapshot.data() as UserProfile);
     } else {
       setProfile(null);
     }
     setLoading(false);
   }, (error) => {
     console.error("Error fetching profile:", error);
     setLoading(false);
   });

   return () => unsubscribe();
 }, [user]);

 const updateProfile = async (data: Partial<UserProfile>) => {
   if (!user) return;
   const profileRef = doc(db, `users/${user.uid}`);
   await setDoc(profileRef, data, { merge: true });
 };

 return {
   profile,
   loading,
   updateProfile
 };
};

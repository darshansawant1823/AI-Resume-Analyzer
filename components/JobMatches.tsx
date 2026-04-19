
import React, { useState, useEffect, useRef } from 'react';
import { Briefcase, MapPin, ExternalLink, Calendar, Search, Building2, Sparkles, Loader2, Globe, Tag, X, Navigation } from 'lucide-react';
import { AnalysisResult } from '../types';
import { findMatchedJobs } from '../services/geminiService';

interface JobMatchesProps {
  resumeText: string;
  initialJobs?: AnalysisResult['matched_jobs'];
  suggestedTitle?: string;
}

export const JobMatches: React.FC<JobMatchesProps> = ({ resumeText, initialJobs, suggestedTitle }) => {
  const [jobs, setJobs] = useState<AnalysisResult['matched_jobs']>(initialJobs || []);
  const [locationInput, setLocationInput] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!initialJobs && initialJobs.length > 0);
  const [isLocating, setIsLocating] = useState(false);

  const fetchJobs = async (customLocations?: string[]) => {
    setIsLoading(true);
    try {
      const searchRole = suggestedTitle || "UX Designer"; 
      const locations = customLocations || selectedLocations;
      
      // If no locations, we search globally/remotely
      const locationQuery = locations.length > 0 ? locations.join(', ') : '';
      
      // Simplify query to maximize result volume - JSearch handles platforms automatically
      const cleanQuery = `${searchRole} jobs`;
      
      const url = `/api/jobs?query=${encodeURIComponent(cleanQuery)}&location=${encodeURIComponent(locationQuery)}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch jobs');
      }
      
      const results = await response.json();
      setJobs(results);
      setHasSearched(true);
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
      try {
        const locations = customLocations || selectedLocations;
        const results = await findMatchedJobs(resumeText, locations.join(', ') || 'Remote');
        if (results && results.length > 0) {
          setJobs(results);
          setHasSearched(true);
        }
      } catch (geminiError) {
        console.error("Gemini fallback also failed:", geminiError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Reverse geocode to get city name using a free service
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const city = data.address.city || data.address.state || data.address.country;
          
          if (city && !selectedLocations.includes(city)) {
            const newLocations = [...selectedLocations, city];
            setSelectedLocations(newLocations);
            fetchJobs(newLocations);
          }
        } catch (error) {
          console.error("Error reverse geocoding:", error);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsLocating(false);
        alert("Could not get your location. Please check browser permissions.");
      }
    );
  };

  const addLocation = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = locationInput.trim();
    if (trimmed && !selectedLocations.includes(trimmed)) {
      setSelectedLocations([...selectedLocations, trimmed]);
      setLocationInput('');
    }
  };

  const removeLocation = (loc: string) => {
    setSelectedLocations(selectedLocations.filter(l => l !== loc));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (locationInput.trim()) {
      const newLocs = [...selectedLocations, locationInput.trim()];
      setSelectedLocations(newLocs);
      setLocationInput('');
      fetchJobs(newLocs);
    } else {
      fetchJobs();
    }
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-8">
        {/* Header and Controls Centered */}
        <div className="text-center space-y-2">
          <h3 className="text-3xl font-black text-gray-900 flex items-center justify-center gap-3 tracking-tight">
            <Sparkles className="w-8 h-8 text-blue-600" />
            Live Job Matches
          </h3>
          <p className="text-sm text-gray-500 font-medium">
            Personalized <span className="text-blue-600 font-bold">"{suggestedTitle || 'your profile'}"</span> openings from LinkedIn, Naukri, and across the web.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 w-full">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <button
              onClick={handleUseLocation}
              disabled={isLocating}
              className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              {isLocating ? 'Locating...' : 'Use my current location'}
            </button>
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest px-4">OR</span>
            <div className="flex flex-wrap items-center justify-center gap-2">
               {['Remote', 'Mumbai', 'Bangalore', 'Delhi', 'Pune'].map(city => {
                 const isSelected = selectedLocations.includes(city);
                 return (
                   <button
                     key={city}
                     type="button"
                     onClick={() => {
                       if (isSelected) {
                         removeLocation(city);
                       } else {
                         setSelectedLocations([...selectedLocations, city]);
                       }
                     }}
                     className={`px-4 py-2 text-[11px] font-bold rounded-xl transition-all border transform active:scale-95 ${
                       isSelected 
                       ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20' 
                       : 'bg-white border-gray-100 text-gray-600 hover:border-blue-200 hover:text-blue-600'
                     }`}
                   >
                     {isSelected ? <Tag className="w-3 h-3 inline mr-1" /> : '+ '}
                     {city}
                   </button>
                 );
               })}
            </div>
          </div>

          <form onSubmit={handleSearch} className="w-full max-w-2xl relative group">
            <div className="flex flex-wrap items-center gap-2 p-2 bg-white border border-gray-100 rounded-[2rem] shadow-apple-card focus-within:ring-4 focus-within:ring-blue-600/5 focus-within:border-blue-600/20 transition-all">
              <div className="flex flex-wrap gap-2 flex-1 min-w-0 px-2">
                {selectedLocations.map(loc => (
                  <span key={loc} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full animate-in zoom-in-95 group-hover:bg-blue-100/50 transition-colors">
                    {loc}
                    <button type="button" onClick={() => removeLocation(loc)} className="hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && locationInput.trim()) {
                      e.preventDefault();
                      addLocation();
                    }
                  }}
                  placeholder={selectedLocations.length === 0 ? "Add a city and press Enter..." : "Add more locations..."}
                  className="flex-1 min-w-[150px] px-2 py-2 text-sm outline-none bg-transparent placeholder:text-gray-300"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="px-8 py-3 bg-gray-900 text-white text-sm font-black rounded-full hover:bg-blue-600 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:scale-100 shadow-xl shadow-gray-900/10"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isLoading ? 'SEARCHING...' : 'GET VACANCIES'}
              </button>
            </div>
            {selectedLocations.length > 0 && (
              <button 
                type="button"
                onClick={() => setSelectedLocations([])}
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-bold hover:text-red-500 transition-colors uppercase tracking-widest"
              >
                Clear all filters
              </button>
            )}
          </form>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-blue-50 border-t-blue-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-blue-100" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-gray-900 tracking-[0.2em] uppercase">Fetching Live Postings</p>
            <p className="text-xs text-gray-400 mt-2 font-medium">Scanning LinkedIn & Naukri for matches...</p>
          </div>
        </div>
      ) : jobs && jobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job, i) => (
            <a
              key={i}
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-apple-card hover:shadow-apple-card-hover hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors shrink-0">
                      <Building2 className="w-7 h-7 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0 text-left pt-1">
                      <h4 className="text-base font-black text-gray-900 truncate group-hover:text-blue-600 transition-colors leading-tight">{job.title}</h4>
                      <p className="text-sm text-gray-500 truncate font-bold mt-1 uppercase tracking-tight opacity-70">{job.company}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  <span className="px-3 py-1 bg-gray-50 text-[10px] font-black text-gray-400 border border-gray-100 rounded-full group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors uppercase tracking-widest">
                    {job.source}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                    <MapPin className="w-3.5 h-3.5" />
                    {job.location}
                  </div>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 font-medium opacity-80">
                  {job.descriptionSnippet}
                </p>

                <div className="pt-4 flex items-center justify-between border-t border-gray-50 group-hover:border-blue-50 transition-colors">
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-black uppercase tracking-widest">
                    Apply Now
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300">
                    <Calendar className="w-3 h-3" />
                    {job.postedAt}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="p-20 text-center bg-white rounded-[3rem] border border-gray-100 shadow-apple-card animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Briefcase className="w-10 h-10 text-gray-200" />
          </div>
          <h4 className="text-2xl font-black text-gray-900 mb-2">Ready to find your match?</h4>
          <p className="text-gray-400 max-w-sm mx-auto leading-relaxed font-medium">
            Select your preferred cities above or use your current location to scan for live vacancies.
          </p>
        </div>
      )}
    </div>
  );
};

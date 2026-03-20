import React from 'react';
import { Button } from '@/components/ui/button';

const SimpleTestPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-4 font-sans text-center">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-blue-100">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-2">System Operational</h1>
        <p className="text-slate-600 mb-6">
          The React application core is rendering correctly. If you are seeing this, the build process and basic routing are working.
        </p>

        <div className="space-y-3">
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => window.location.href = '/'}
          >
            Go to Landing Page
          </Button>
          
          <Button 
            variant="outline"
            className="w-full"
            onClick={() => console.log("Test interaction works")}
          >
            Test Console Log
          </Button>
        </div>
        
        <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-400">
          Rendered at: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default SimpleTestPage;
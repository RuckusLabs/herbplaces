import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import  supabase from '/src/utilities/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth callback error:', error);
        navigate('/auth?error=Authentication failed');
      } else if (session) {
        navigate('/');
      } else {
        navigate('/auth');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return <div>Completing authentication...</div>;
}
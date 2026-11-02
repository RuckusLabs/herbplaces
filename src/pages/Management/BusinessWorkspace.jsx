import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useManagement } from '../../contexts/ManagementContext';
import usePlaces from '../../hooks/usePlaces';
import { growthEnabled, emailReportsEnabled } from '../../utilities/growthApi';
import BusinessTools from '../../components/BusinessTools/BusinessTools';
import Icon from '../../components/Icons/Icon';
import styles from './businessWorkspace.module.scss';

const tabs = [
  { id:'overview',label:'Overview',icon:'plan-profile',description:'A few useful steps to keep your place ready for visitors.' },
  { id:'listing',label:'Listing & Highlights',icon:'plan-story',description:'Keep your story, offerings, and visit information up to date.' },
  { id:'activity',label:'Activity',icon:'plan-report',description:'Understand the interest in your place.' },
  { id:'email',label:'Email Reports',icon:'plan-email',description:'Choose whether to receive a monthly summary.' },
];

export default function BusinessWorkspace() {
  const {user,loading:authLoading}=useAuth();
  const management=useManagement();
  const {places,loading:placesLoading,error:placesError,retry:retryPlaces}=usePlaces(!!user && management.is_admin);
  const [params,setParams]=useSearchParams();
  const navigate=useNavigate();
  const [attempt,setAttempt]=useState(0);
  const available=management.is_admin ? places : management.memberships.map(membership=>({...membership.place,id:membership.place_id}));
  const selected=available.find(place=>String(place.id)===params.get('place')) || available[0];
  const allowedTabs=tabs.filter(tab=>tab.id!=='email' || emailReportsEnabled);
  const activeTab=allowedTabs.find(tab=>tab.id===params.get('tab')) || allowedTabs[0];
  const change=(key,value)=>{const next=new URLSearchParams(params);next.set(key,value);if(selected)next.set('place',String(key==='place'?value:selected.id));setParams(next);};
  if(!authLoading && !user)return <Navigate to={`/login?next=${encodeURIComponent(`/business-tools${params.size?`?${params}`:''}`)}`} replace />;
  return <main id="main-content" className={styles.page}>
    <Helmet><title>Business Tools & Activity | Little Herb Places</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <header className={styles.header}><div><Link to="/my-places" className={styles.back}>← My Places</Link><h1>Business Tools & Activity</h1><p>A little space to care for your listing and see what’s working.</p></div>{selected && <Link className="button" to={`/place/${selected.urlSlug}`}>View Listing <Icon name="arrow" size={16} /></Link>}</header>
    {authLoading || management.loading || (management.is_admin && placesLoading) ? <p role="status">Gathering your business tools…</p> : (management.error || (management.is_admin && placesError)) ? <div role="alert"><p>{management.error || placesError}</p><button className="button" onClick={()=>{management.refresh();retryPlaces();}}>Retry Access</button></div> : !growthEnabled ? <p>Business tools are being prepared. <Link to="/my-places">Open My Places</Link> for listing and membership details.</p> : !selected ? <section className={styles.empty}><Icon name="shop" size={54} /><h2>Your Business Starts With a Listing</h2><p>Tools become available after your ownership claim is approved. Check your claims and listing requests in My Places.</p><Link className="button" to="/my-places">Open My Places</Link></section> : <>
      <div className={styles.placeBar}><div><Icon name="shop" size={32} /><div><span>Managing</span><strong>{selected.name}</strong><p>{[selected.city,selected.state].filter(Boolean).join(', ')}</p></div></div>{available.length>1 && <label>Choose a Place<select value={selected.id} onChange={event=>change('place',event.target.value)}>{available.map(place=><option key={place.id} value={place.id}>{place.name}</option>)}</select></label>}</div>
      <div className={styles.layout}><nav aria-label="Business tools sections" className={styles.nav}>{allowedTabs.map(tab=><button key={tab.id} aria-current={tab.id===activeTab.id?'page':undefined} onClick={()=>change('tab',tab.id)}><Icon name={tab.icon} size={32} />{tab.label}</button>)}<Link to="/my-places">Membership & Billing <Icon name="arrow" size={14} /></Link></nav>
        <section className={styles.panel} aria-label={activeTab.label}><div className={styles.panelHeader}><div><h2>{activeTab.label}</h2><p>{activeTab.description}</p></div><button className={styles.refresh} onClick={()=>setAttempt(value=>value+1)} aria-label="Refresh Business Tools">Refresh</button></div><BusinessTools key={`${user.id}:${selected.id}:${attempt}`} place={selected} view={activeTab.id} onChanged={management.refresh} onEdit={section=>navigate(`/place/${selected.urlSlug}?business=${section}`)} /></section>
      </div>
    </>}
  </main>;
}

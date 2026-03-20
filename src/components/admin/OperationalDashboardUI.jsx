import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, Users, Calendar, CheckCircle, AlertTriangle, XCircle, 
  Clock, Plus, FileText, UserPlus, PhoneCall, TrendingUp, TrendingDown,
  LayoutGrid, List, AlertCircle, ChevronRight, MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- Dummy Data ---

const KPI_STATS = [
  { label: 'Total Sesi', value: '1,248', change: '+12%', trend: 'up', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Total Paket', value: '320', change: '+8%', trend: 'up', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
  { label: 'Total Non-Paket', value: '145', change: '-3%', trend: 'down', icon: LayersIcon, color: 'text-orange-600', bg: 'bg-orange-50' },
  { label: 'Total Pasien', value: '856', change: '+5%', trend: 'up', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
];

const TODAY_TASKS = [
  { label: 'Total Appointment', value: 42, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-100', borderColor: 'border-blue-200' },
  { label: 'Reschedule', value: 5, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', borderColor: 'border-amber-200' },
  { label: 'Cancel', value: 2, icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', borderColor: 'border-red-200' },
];

const THERAPIST_AVAILABILITY = [
  { name: 'Dr. Sarah', status: 'Aktif', hours: '08:00 - 16:00', capacity: 85, avatar: 'S' },
  { name: 'Dr. Budi', status: 'Aktif', hours: '09:00 - 17:00', capacity: 60, avatar: 'B' },
  { name: 'Dr. Ayu', status: 'Izin', hours: '-', capacity: 0, avatar: 'A' },
  { name: 'Dr. Reza', status: 'Aktif', hours: '13:00 - 20:00', capacity: 40, avatar: 'R' },
];

const DAILY_REPORT_COMPLETION = [
  { therapist: 'Dr. Sarah', rekamMedis: true, evaluasi: true },
  { therapist: 'Dr. Budi', rekamMedis: true, evaluasi: false },
  { therapist: 'Dr. Reza', rekamMedis: false, evaluasi: false },
  { therapist: 'Dr. Maya', rekamMedis: true, evaluasi: true },
];

const THERAPIST_WORKLOAD = [
  { name: 'Dr. Sarah', newPatients: 2, oldPatients: 6, package: 5, nonPackage: 3, homecare: 0, total: 8 },
  { name: 'Dr. Budi', newPatients: 1, oldPatients: 5, package: 4, nonPackage: 2, homecare: 1, total: 7 },
  { name: 'Dr. Reza', newPatients: 3, oldPatients: 2, package: 2, nonPackage: 3, homecare: 0, total: 5 },
  { name: 'Dr. Maya', newPatients: 0, oldPatients: 4, package: 3, nonPackage: 1, homecare: 0, total: 4 },
];

const RECENT_PATIENTS = [
  { name: 'Budi Santoso', rm: 'RM00123', status: 'Active', lastVisit: '2024-01-10' },
  { name: 'Siti Aminah', rm: 'RM00124', status: 'Active', lastVisit: '2024-01-11' },
  { name: 'Ahmad Rizki', rm: 'RM00125', status: 'Inactive', lastVisit: '2023-12-20' },
];

const RECENT_RECAPS = [
  { date: '2024-01-12', patient: 'Budi Santoso', service: 'Physio Session', therapist: 'Dr. Sarah' },
  { date: '2024-01-12', patient: 'Siti Aminah', service: 'Manual Therapy', therapist: 'Dr. Budi' },
  { date: '2024-01-11', patient: 'Dewi Lestari', service: 'Consultation', therapist: 'Dr. Sarah' },
];

// Helper icon component
function LayersIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  )
}

const OperationalDashboardUI = () => {
  const [activeTab, setActiveTab] = useState("recaps");

  return (
    <div className="space-y-8 pb-12">
      {/* 1. KPI Cards Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_STATS.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="rounded-xl border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                    stat.trend === 'up' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                  }`}>
                    {stat.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {stat.change}
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-bold text-slate-900">{stat.value}</h3>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      {/* 2. Today Task Overview */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
           <Calendar className="w-5 h-5 text-blue-600" />
           Today's Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TODAY_TASKS.map((task, index) => (
            <Card key={index} className={`rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all ${task.borderColor}`}>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{task.label}</p>
                  <h3 className="text-4xl font-extrabold text-slate-800">{task.value}</h3>
                </div>
                <div className={`p-4 rounded-full ${task.bg} ${task.color}`}>
                  <task.icon className="w-8 h-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 3. Schedule Control (Placeholder Visualization) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-xl border-slate-200 shadow-sm h-full">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-800">Schedule Timeline</CardTitle>
                  <CardDescription>Visual overview of therapist slots today</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-slate-50">08:00 - 12:00</Badge>
                  <Badge variant="outline" className="bg-slate-50">13:00 - 17:00</Badge>
                  <Badge variant="outline" className="bg-slate-50">17:00 - 21:00</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {['Dr. Sarah', 'Dr. Budi', 'Dr. Reza'].map((therapist, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="w-24 font-semibold text-sm text-slate-700 flex-shrink-0">{therapist}</div>
                    <div className="flex-1 w-full grid grid-cols-8 gap-2">
                      {[...Array(8)].map((_, j) => {
                        const status = Math.random() > 0.7 ? 'empty' : Math.random() > 0.5 ? 'filled' : 'overlap';
                        return (
                          <div 
                            key={j} 
                            className={`h-10 rounded-md flex items-center justify-center text-xs font-medium cursor-pointer transition-all hover:scale-105 border ${
                              status === 'empty' ? 'bg-slate-50 border-slate-200 text-slate-400 border-dashed' :
                              status === 'filled' ? 'bg-blue-100 border-blue-200 text-blue-700' :
                              'bg-red-100 border-red-200 text-red-700'
                            }`}
                          >
                            {status === 'filled' && 'Booked'}
                            {status === 'overlap' && <AlertTriangle className="w-4 h-4" />}
                            {status === 'empty' && '+'}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-end gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-50 border border-slate-300 border-dashed rounded"></div> Empty</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div> Booked</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div> Conflict/Overlap</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 4. Therapist Availability List */}
        <div className="space-y-6">
           <Card className="rounded-xl border-slate-200 shadow-sm h-full">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg font-bold text-slate-800">Therapist Status</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-slate-100">
                 {THERAPIST_AVAILABILITY.map((therapist, index) => (
                   <div key={index} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                          {therapist.avatar}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-900">{therapist.name}</p>
                          <p className="text-xs text-slate-500">{therapist.hours}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={therapist.status === 'Aktif' ? 'default' : 'secondary'} className={
                          therapist.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' : 
                          'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                        }>
                          {therapist.status}
                        </Badge>
                        {therapist.status === 'Aktif' && (
                          <div className="w-20">
                             <Progress value={therapist.capacity} className="h-1.5" />
                          </div>
                        )}
                      </div>
                   </div>
                 ))}
               </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* 5. Daily Report Completion Table */}
         <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-800">Laporan Harian</CardTitle>
              <Badge variant="outline" className="text-xs font-normal">Hari Ini</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700">Terapis</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700">Rekam Medis</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700">Evaluasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DAILY_REPORT_COMPLETION.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-slate-800">{row.therapist}</TableCell>
                      <TableCell className="text-center">
                        {row.rekamMedis ? 
                          <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" /> : 
                          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
                        }
                      </TableCell>
                      <TableCell className="text-center">
                         {row.evaluasi ? 
                          <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" /> : 
                          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
         </Card>

         {/* 6. Workload Table */}
         <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-800">Beban Kerja Terapis</CardTitle>
              <Badge variant="outline" className="text-xs font-normal">Minggu Ini</Badge>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
               <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700">Terapis</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700 text-xs">Baru</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700 text-xs">Lama</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700 text-xs">Paket</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700 text-xs">Total</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {THERAPIST_WORKLOAD.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-slate-800 text-xs">{row.name}</TableCell>
                      <TableCell className="text-center text-xs">{row.newPatients}</TableCell>
                      <TableCell className="text-center text-xs">{row.oldPatients}</TableCell>
                      <TableCell className="text-center text-xs">{row.package}</TableCell>
                      <TableCell className="text-center font-bold text-slate-900">{row.total}</TableCell>
                      <TableCell>
                         <div className="flex h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                           <div className="bg-blue-500 h-full" style={{ width: `${(row.newPatients / row.total) * 100}%` }}></div>
                           <div className="bg-indigo-500 h-full" style={{ width: `${(row.oldPatients / row.total) * 100}%` }}></div>
                           <div className="bg-purple-500 h-full" style={{ width: `${(row.package / row.total) * 100}%` }}></div>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
               </Table>
            </CardContent>
         </Card>
      </div>

      {/* 7. Patient Management Quick Access */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <Tabs defaultValue="recaps" className="w-full" onValueChange={setActiveTab}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
             <div className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-slate-500" />
                <h3 className="text-lg font-bold text-slate-800">Quick Access Management</h3>
             </div>
             <TabsList>
                <TabsTrigger value="recaps">Daily Recaps</TabsTrigger>
                <TabsTrigger value="patients">Pasien</TabsTrigger>
                <TabsTrigger value="history">Riwayat Paket</TabsTrigger>
                <TabsTrigger value="followup">Follow Up</TabsTrigger>
             </TabsList>
          </div>
          
          <TabsContent value="recaps" className="mt-0">
             <Table>
                <TableHeader>
                   <TableRow>
                     <TableHead>Date</TableHead>
                     <TableHead>Patient</TableHead>
                     <TableHead>Service</TableHead>
                     <TableHead>Therapist</TableHead>
                     <TableHead className="text-right">Action</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {RECENT_RECAPS.map((recap, i) => (
                    <TableRow key={i}>
                       <TableCell>{recap.date}</TableCell>
                       <TableCell className="font-medium">{recap.patient}</TableCell>
                       <TableCell>{recap.service}</TableCell>
                       <TableCell>{recap.therapist}</TableCell>
                       <TableCell className="text-right">
                         <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                           <MoreHorizontal className="w-4 h-4" />
                         </Button>
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
             </Table>
             <div className="mt-4 text-center">
                <Button variant="link" className="text-blue-600">View All Recaps <ChevronRight className="w-4 h-4 ml-1" /></Button>
             </div>
          </TabsContent>
          
          <TabsContent value="patients" className="mt-0">
             <Table>
                <TableHeader>
                   <TableRow>
                     <TableHead>Name</TableHead>
                     <TableHead>RM Number</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Last Visit</TableHead>
                     <TableHead className="text-right">Action</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {RECENT_PATIENTS.map((patient, i) => (
                    <TableRow key={i}>
                       <TableCell className="font-medium">{patient.name}</TableCell>
                       <TableCell>{patient.rm}</TableCell>
                       <TableCell><Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{patient.status}</Badge></TableCell>
                       <TableCell>{patient.lastVisit}</TableCell>
                       <TableCell className="text-right">
                         <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                           <MoreHorizontal className="w-4 h-4" />
                         </Button>
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
             </Table>
             <div className="mt-4 text-center">
                <Button variant="link" className="text-blue-600">View All Patients <ChevronRight className="w-4 h-4 ml-1" /></Button>
             </div>
          </TabsContent>

          {/* Placeholder contents for other tabs */}
          <TabsContent value="history">
            <div className="p-8 text-center text-slate-500 border-2 border-dashed border-slate-100 rounded-lg">
               <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
               <p>Package History data will appear here.</p>
            </div>
          </TabsContent>
          
           <TabsContent value="followup">
            <div className="p-8 text-center text-slate-500 border-2 border-dashed border-slate-100 rounded-lg">
               <PhoneCall className="w-10 h-10 mx-auto mb-2 text-slate-300" />
               <p>Follow Up schedule will appear here.</p>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* 8. Quick Action Floating Panel */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button size="lg" className="rounded-full h-14 w-14 shadow-xl bg-blue-600 hover:bg-blue-700 text-white p-0 flex items-center justify-center">
                  <Plus className="w-6 h-6" />
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mb-2">
               <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
               <DropdownMenuSeparator />
               <DropdownMenuItem className="cursor-pointer gap-2">
                  <FileText className="w-4 h-4" /> New Daily Recap
               </DropdownMenuItem>
               <DropdownMenuItem className="cursor-pointer gap-2">
                  <UserPlus className="w-4 h-4" /> New Patient
               </DropdownMenuItem>
               <DropdownMenuItem className="cursor-pointer gap-2">
                  <Calendar className="w-4 h-4" /> New Appointment
               </DropdownMenuItem>
               <DropdownMenuItem className="cursor-pointer gap-2">
                  <PhoneCall className="w-4 h-4" /> Follow Up Task
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </div>
    </div>
  );
};

export default OperationalDashboardUI;
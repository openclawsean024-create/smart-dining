import { Link } from 'react-router-dom';
import { Header } from '../components/Header';

export function NotFoundPage() {
  return (
    <div className="h-full w-full flex flex-col bg-gray-50">
      <Header />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-9xl mb-4" aria-hidden="true">🥺</div>
          <h1 className="font-black text-kiosk-3xl text-gray-900">找不到此頁面</h1>
          <p className="mt-3 text-kiosk-base text-gray-500">
            請回到首頁或聯絡店員協助。
          </p>
          <Link
            to="/"
            className="inline-block mt-6 h-touch px-8 leading-[64px] rounded-xl bg-primary text-white font-black text-kiosk-base btn-press"
          >
            回到首頁
          </Link>
        </div>
      </div>
    </div>
  );
}

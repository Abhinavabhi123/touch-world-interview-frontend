import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NgxSonnerToaster } from 'ngx-sonner';
import { LoadingService } from './services/loading.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NgxSonnerToaster, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly loadingService = inject(LoadingService);
}

package com.transport.management;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.CrossOrigin;

@SpringBootApplication
@CrossOrigin(origins = "*")
public class TransportManagementApplication {
    public static void main(String[] args) {
        SpringApplication.run(TransportManagementApplication.class, args);
        System.out.println("🚀 Transport Management System Started!");
        System.out.println("🌐 Server available on LAN at: http://192.168.1.3:8080");
        System.out.println("📊 API Documentation: http://192.168.1.3:8080/api/health");
    }
}

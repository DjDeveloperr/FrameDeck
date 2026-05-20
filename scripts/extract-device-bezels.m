#import <Foundation/Foundation.h>

#import "XCWChromeRenderer.h"

static NSString *const SDDeviceTypesPath =
    @"/Library/Developer/CoreSimulator/Profiles/DeviceTypes";

static NSString *SDFamilyForDevice(NSString *deviceName, NSDictionary *profile) {
    if ([deviceName hasPrefix:@"iPhone "]) {
        return @"iphone";
    }
    if ([deviceName hasPrefix:@"iPad "]) {
        return @"ipad";
    }
    if ([deviceName hasPrefix:@"Apple Watch "]) {
        return @"apple-watch";
    }

    NSArray *families = [profile[@"supportedProductFamilyIDs"] isKindOfClass:[NSArray class]]
        ? profile[@"supportedProductFamilyIDs"]
        : @[];
    BOOL supportsWatch = NO;
    BOOL supportsPad = NO;
    BOOL supportsPhone = NO;
    for (id family in families) {
        if (![family respondsToSelector:@selector(integerValue)]) {
            continue;
        }
        NSInteger value = [family integerValue];
        supportsPhone = supportsPhone || value == 1;
        supportsPad = supportsPad || value == 2;
        supportsWatch = supportsWatch || value == 4;
    }
    if (supportsWatch) {
        return @"apple-watch";
    }
    if (supportsPad && [deviceName containsString:@"iPad"]) {
        return @"ipad";
    }
    if (supportsPhone && [deviceName containsString:@"iPhone"]) {
        return @"iphone";
    }
    return nil;
}

static NSString *SDSlugComponent(NSString *value) {
    NSMutableString *mutable = [[value ?: @"" lowercaseString] mutableCopy];
    CFStringTransform((__bridge CFMutableStringRef)mutable, NULL, kCFStringTransformToLatin, false);
    CFStringTransform((__bridge CFMutableStringRef)mutable, NULL, kCFStringTransformStripCombiningMarks, false);

    NSMutableString *slug = [NSMutableString string];
    BOOL previousDash = NO;
    for (NSUInteger i = 0; i < mutable.length; i++) {
        unichar ch = [mutable characterAtIndex:i];
        if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
            [slug appendFormat:@"%C", ch];
            previousDash = NO;
        } else if (!previousDash) {
            [slug appendString:@"-"];
            previousDash = YES;
        }
    }
    while ([slug hasPrefix:@"-"]) {
        [slug deleteCharactersInRange:NSMakeRange(0, 1)];
    }
    while ([slug hasSuffix:@"-"]) {
        [slug deleteCharactersInRange:NSMakeRange(slug.length - 1, 1)];
    }
    return slug.length > 0 ? slug : @"device";
}

static NSString *SDUniqueSlug(NSString *deviceName,
                              NSDictionary *profile,
                              NSMutableSet<NSString *> *usedSlugs) {
    NSString *model = [profile[@"modelIdentifier"] isKindOfClass:[NSString class]]
        ? profile[@"modelIdentifier"]
        : @"";
    NSString *base = model.length > 0
        ? [NSString stringWithFormat:@"%@-%@", SDSlugComponent(deviceName), SDSlugComponent(model)]
        : SDSlugComponent(deviceName);
    NSString *candidate = base;
    NSUInteger suffix = 2;
    while ([usedSlugs containsObject:candidate]) {
        candidate = [NSString stringWithFormat:@"%@-%lu", base, (unsigned long)suffix++];
    }
    [usedSlugs addObject:candidate];
    return candidate;
}

static NSDictionary *SDRectDictionaryFromImageData(NSData *data) {
    NSBitmapImageRep *rep = [NSBitmapImageRep imageRepWithData:data];
    if (rep == nil) {
        return @{};
    }
    return @{
        @"pixelWidth": @(rep.pixelsWide),
        @"pixelHeight": @(rep.pixelsHigh),
    };
}

static BOOL SDWriteData(NSData *data, NSString *path, NSMutableArray<NSDictionary *> *errors, NSString *label) {
    NSError *error = nil;
    if (![data writeToFile:path options:NSDataWritingAtomic error:&error]) {
        [errors addObject:@{
            @"device": label ?: @"",
            @"error": error.localizedDescription ?: @"Unable to write data.",
        }];
        return NO;
    }
    return YES;
}

static id SDJSONObjectOrNull(id value) {
    return value ?: [NSNull null];
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSString *outputRoot = argc > 1
            ? [NSString stringWithUTF8String:argv[1]]
            : [[[NSFileManager defaultManager] currentDirectoryPath] stringByAppendingPathComponent:@"assets/device-bezels"];
        outputRoot = [outputRoot stringByStandardizingPath];

        NSFileManager *fileManager = [NSFileManager defaultManager];
        NSError *directoryError = nil;
        [fileManager removeItemAtPath:outputRoot error:nil];
        if (![fileManager createDirectoryAtPath:outputRoot
                    withIntermediateDirectories:YES
                                     attributes:nil
                                          error:&directoryError]) {
            fprintf(stderr, "Unable to create output directory: %s\n",
                    directoryError.localizedDescription.UTF8String);
            return 1;
        }

        NSArray<NSString *> *entries = [fileManager contentsOfDirectoryAtPath:SDDeviceTypesPath
                                                                        error:&directoryError];
        if (entries == nil) {
            fprintf(stderr, "Unable to read CoreSimulator device profiles: %s\n",
                    directoryError.localizedDescription.UTF8String);
            return 1;
        }

        entries = [entries sortedArrayUsingSelector:@selector(localizedCaseInsensitiveCompare:)];
        NSMutableArray<NSDictionary *> *devices = [NSMutableArray array];
        NSMutableArray<NSDictionary *> *errors = [NSMutableArray array];
        NSMutableDictionary<NSString *, NSNumber *> *counts = [@{
            @"iphone": @0,
            @"ipad": @0,
            @"apple-watch": @0,
        } mutableCopy];
        NSMutableSet<NSString *> *usedSlugs = [NSMutableSet set];

        for (NSString *entry in entries) {
            if (![entry.pathExtension isEqualToString:@"simdevicetype"]) {
                continue;
            }

            NSString *deviceName = entry.stringByDeletingPathExtension;
            NSString *bundlePath = [SDDeviceTypesPath stringByAppendingPathComponent:entry];
            NSString *resourcesPath = [bundlePath stringByAppendingPathComponent:@"Contents/Resources"];
            NSString *profilePath = [resourcesPath stringByAppendingPathComponent:@"profile.plist"];
            NSDictionary *profile = [NSDictionary dictionaryWithContentsOfFile:profilePath];
            if (![profile isKindOfClass:[NSDictionary class]]) {
                continue;
            }

            NSString *family = SDFamilyForDevice(deviceName, profile);
            if (family == nil) {
                continue;
            }

            NSString *chromeIdentifier = [profile[@"chromeIdentifier"] isKindOfClass:[NSString class]]
                ? profile[@"chromeIdentifier"]
                : @"";
            if (chromeIdentifier.length == 0) {
                [errors addObject:@{
                    @"device": deviceName,
                    @"error": @"Device profile did not include a chromeIdentifier.",
                }];
                continue;
            }

            NSError *renderError = nil;
            NSDictionary *geometry = [XCWChromeRenderer profileForDeviceName:deviceName error:&renderError];
            if (geometry == nil) {
                [errors addObject:@{
                    @"device": deviceName,
                    @"error": renderError.localizedDescription ?: @"Unable to resolve chrome geometry.",
                }];
                continue;
            }

            NSData *bezel = [XCWChromeRenderer PNGDataForDeviceName:deviceName
                                                      includeButtons:YES
                                                               error:&renderError];
            if (bezel.length == 0) {
                [errors addObject:@{
                    @"device": deviceName,
                    @"error": renderError.localizedDescription ?: @"Unable to render bezel PNG.",
                }];
                continue;
            }

            NSData *bezelNoButtons = [XCWChromeRenderer PNGDataForDeviceName:deviceName
                                                               includeButtons:NO
                                                                        error:&renderError];
            if (bezelNoButtons.length == 0) {
                [errors addObject:@{
                    @"device": deviceName,
                    @"error": renderError.localizedDescription ?: @"Unable to render no-buttons bezel PNG.",
                }];
                continue;
            }

            NSString *slug = SDUniqueSlug(deviceName, profile, usedSlugs);
            NSString *relativeDeviceDirectory = [family stringByAppendingPathComponent:slug];
            NSString *deviceDirectory = [outputRoot stringByAppendingPathComponent:relativeDeviceDirectory];
            if (![fileManager createDirectoryAtPath:deviceDirectory
                        withIntermediateDirectories:YES
                                         attributes:nil
                                              error:&directoryError]) {
                [errors addObject:@{
                    @"device": deviceName,
                    @"error": directoryError.localizedDescription ?: @"Unable to create device output directory.",
                }];
                continue;
            }

            NSString *bezelPath = [deviceDirectory stringByAppendingPathComponent:@"bezel.png"];
            NSString *bezelNoButtonsPath = [deviceDirectory stringByAppendingPathComponent:@"bezel-no-buttons.png"];
            if (!SDWriteData(bezel, bezelPath, errors, deviceName) ||
                !SDWriteData(bezelNoButtons, bezelNoButtonsPath, errors, deviceName)) {
                continue;
            }

            NSString *screenMaskRelativePath = nil;
            NSData *mask = [XCWChromeRenderer screenMaskPNGDataForDeviceName:deviceName error:nil];
            if (mask.length > 0) {
                NSString *maskPath = [deviceDirectory stringByAppendingPathComponent:@"screen-mask.png"];
                if (SDWriteData(mask, maskPath, errors, deviceName)) {
                    screenMaskRelativePath = [relativeDeviceDirectory stringByAppendingPathComponent:@"screen-mask.png"];
                }
            }

            NSString *chromeName = [chromeIdentifier stringByReplacingOccurrencesOfString:@"com.apple.dt.devicekit.chrome."
                                                                               withString:@""];
            NSString *chromeResourcesPath = chromeName.length > 0
                ? [NSString stringWithFormat:@"/Library/Developer/DeviceKit/Chrome/%@.devicechrome/Contents/Resources", chromeName]
                : @"";
            NSString *framebufferMask = [profile[@"framebufferMask"] isKindOfClass:[NSString class]]
                ? profile[@"framebufferMask"]
                : @"";
            NSString *sensorBarImage = [profile[@"sensorBarImage"] isKindOfClass:[NSString class]]
                ? profile[@"sensorBarImage"]
                : @"";
            NSDictionary *screen = @{
                @"pixelWidth": SDJSONObjectOrNull(profile[@"mainScreenWidth"]),
                @"pixelHeight": SDJSONObjectOrNull(profile[@"mainScreenHeight"]),
                @"scale": SDJSONObjectOrNull(profile[@"mainScreenScale"]),
                @"widthDPI": SDJSONObjectOrNull(profile[@"mainScreenWidthDPI"]),
                @"heightDPI": SDJSONObjectOrNull(profile[@"mainScreenHeightDPI"]),
            };

            NSMutableDictionary *deviceMetadata = [@{
                @"name": deviceName,
                @"slug": slug,
                @"family": family,
                @"modelIdentifier": SDJSONObjectOrNull(profile[@"modelIdentifier"]),
                @"productClass": SDJSONObjectOrNull(profile[@"productClass"]),
                @"chromeIdentifier": chromeIdentifier,
                @"chromeName": chromeName,
                @"screen": screen,
                @"geometry": geometry,
                @"images": @{
                    @"bezel": [relativeDeviceDirectory stringByAppendingPathComponent:@"bezel.png"],
                    @"bezelNoButtons": [relativeDeviceDirectory stringByAppendingPathComponent:@"bezel-no-buttons.png"],
                    @"screenMask": screenMaskRelativePath ?: [NSNull null],
                },
                @"rendered": @{
                    @"bezel": SDRectDictionaryFromImageData(bezel),
                    @"bezelNoButtons": SDRectDictionaryFromImageData(bezelNoButtons),
                },
                @"source": @{
                    @"deviceProfilePath": profilePath,
                    @"deviceResourcesPath": resourcesPath,
                    @"chromeResourcesPath": chromeResourcesPath,
                    @"framebufferMask": framebufferMask.length > 0 ? framebufferMask : [NSNull null],
                    @"sensorBarImage": sensorBarImage.length > 0 ? sensorBarImage : [NSNull null],
                },
            } mutableCopy];

            if (mask.length > 0) {
                NSMutableDictionary *rendered = [deviceMetadata[@"rendered"] mutableCopy];
                rendered[@"screenMask"] = SDRectDictionaryFromImageData(mask);
                deviceMetadata[@"rendered"] = rendered;
            }

            NSString *metadataPath = [deviceDirectory stringByAppendingPathComponent:@"profile.json"];
            NSData *metadataData = [NSJSONSerialization dataWithJSONObject:deviceMetadata
                                                                   options:NSJSONWritingPrettyPrinted | NSJSONWritingSortedKeys
                                                                     error:&directoryError];
            if (metadataData.length > 0) {
                SDWriteData(metadataData, metadataPath, errors, deviceName);
            }

            [devices addObject:deviceMetadata];
            counts[family] = @([counts[family] unsignedIntegerValue] + 1);
            printf("rendered %-11s %s\n", family.UTF8String, deviceName.UTF8String);
        }

        NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
        formatter.locale = [NSLocale localeWithLocaleIdentifier:@"en_US_POSIX"];
        formatter.dateFormat = @"yyyy-MM-dd'T'HH:mm:ssZZZZZ";
        formatter.timeZone = [NSTimeZone localTimeZone];

        NSDictionary *index = @{
            @"generatedAt": [formatter stringFromDate:[NSDate date]],
            @"source": @{
                @"deviceTypesPath": SDDeviceTypesPath,
                @"deviceKitChromePath": @"/Library/Developer/DeviceKit/Chrome",
                @"renderer": @"SimDeck XCWChromeRenderer",
            },
            @"counts": @{
                @"total": @(devices.count),
                @"iphone": counts[@"iphone"],
                @"ipad": counts[@"ipad"],
                @"appleWatch": counts[@"apple-watch"],
                @"errors": @(errors.count),
            },
            @"devices": devices,
            @"errors": errors,
        };

        NSData *indexData = [NSJSONSerialization dataWithJSONObject:index
                                                            options:NSJSONWritingPrettyPrinted | NSJSONWritingSortedKeys
                                                              error:&directoryError];
        if (indexData.length == 0) {
            fprintf(stderr, "Unable to encode index.json: %s\n",
                    directoryError.localizedDescription.UTF8String);
            return 1;
        }

        NSString *indexPath = [outputRoot stringByAppendingPathComponent:@"index.json"];
        if (!SDWriteData(indexData, indexPath, errors, @"index")) {
            return 1;
        }

        printf("wrote %lu bezel profiles to %s\n",
               (unsigned long)devices.count,
               outputRoot.UTF8String);
        if (errors.count > 0) {
            printf("completed with %lu recoverable errors; see index.json\n",
                   (unsigned long)errors.count);
        }
    }
    return 0;
}

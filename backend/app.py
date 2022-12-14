from base.backend.app import App as BaseApp
from base.backend.app import get_cache_path
from base.backend.app import get_models_path
from base.backend.app import update_user_settings
import os
import flask, jinja2
import json

import backend
import backend.training
from . import root_detection
from . import root_tracking
from . import evaluation

from flask import session

class App(BaseApp):
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        if self.is_reloader:
            return

        self.route('/process_root_tracking', methods=['GET', 'POST'])(self.process_root_tracking)
        self.route('/postprocess_detection/<filename>')(self.postprocess_detection)
        self.route('/evaluation', methods=['POST'])(self.evaluation)
        self.route('/discard_model')(self.discard_model)
        self.route('/refresh_allinfo', methods=['POST'])(self.refresh_allinfo)
        
    def postprocess_detection(self, filename):
        #FIXME: code duplication
        full_path = os.path.join(get_cache_path(), filename)
        if not os.path.exists(full_path):
            flask.abort(404)
        
        result = root_detection.postprocess_segmentation_file(full_path)
        result['segmentation'] = os.path.basename(result['segmentation'])
        result['skeleton']     = os.path.basename(result['skeleton'])
        return flask.jsonify(result)
    

    def process_root_tracking(self):
        if flask.request.method=='GET':
            fname0 = os.path.join(get_cache_path(), flask.request.args['filename0'])
            fname1 = os.path.join(get_cache_path(), flask.request.args['filename1'])
            result = root_tracking.process(fname0, fname1, self.get_settings())
        elif flask.request.method=='POST':
            data   = flask.request.get_json(force=True)
            fname0 = os.path.join(get_cache_path(), data['filename0'])
            fname1 = os.path.join(get_cache_path(), data['filename1'])
            result = root_tracking.process(fname0, fname1, self.get_settings(), data)
        
        return flask.jsonify({
            'points0':         result['points0'].tolist(),
            'points1':         result['points1'].tolist(),
            'growthmap'     :  os.path.basename(result['growthmap']),
            'growthmap_rgba':  os.path.basename(result['growthmap_rgba']),
            'segmentation0' :  os.path.basename(result['segmentation0']),
            'segmentation1' :  os.path.basename(result['segmentation1']),
            'success'       :  result['success'],
            'n_matched_points'   : result['n_matched_points'],
            'tracking_model'     : result['tracking_model'],
            'segmentation_model' : result['segmentation_model'],
            'statistics'         : result['statistics'],
        })

    #override    #TODO: unify
    def training(self):
        requestform  = flask.request.get_json(force=True)
        options      = requestform['options']
        if options['training_type'] not in ['detection', 'exclusion_mask']:
            raise NotImplementedError()

        imagefiles   = requestform['filenames']
        imagefiles   = [os.path.join(get_cache_path(), fname) for fname in imagefiles]
        targetfiles  = backend.training.find_targetfiles(imagefiles)
        if not all([os.path.exists(fname) for fname in imagefiles]) or not all(targetfiles):
            flask.abort(404)
        
        backend.training.start_training(imagefiles, targetfiles, options, self.get_settings())
        return 'OK'

    def evaluation(self):
            requestform  = flask.request.get_json(force=True)
            files = requestform['filenames']
            settings_startingpoint = backend.settings.Settings()
            modeltype = requestform['options']['training_type']
            # Current user settings
            s = session['settings']
            s = s['settings']
            # Update settings active models and load model into settings
            s['active_models'][modeltype] = requestform['startingpoint']
            settings_startingpoint.set_settings(s)
            settings_current = self.get_settings()
            if (modeltype == 'detection'):
                aftertxt = ''
            else:
                aftertxt = '1'
                for f in files:
                    mask = evaluation.load_annotated_mask(get_cache_path(f+'.annotation.png'))
                    backend.write_as_png(get_cache_path(aftertxt+f+'.annotation.png') ,mask) 
            for f in files:
                result = root_detection.run_model(get_cache_path(f), settings_startingpoint,modeltype)
                result = root_detection.postprocess(result)
                segmentation_path  = get_cache_path(aftertxt+f+'.segmentation.png')    
                backend.write_as_png(segmentation_path, result['segmentation'])
            res_startingpoint = evaluation.evaluate_files(files,aftertxt)  
            for f in files:
                os.remove(get_cache_path(aftertxt+f+'.segmentation.png'))
                result = root_detection.run_model(get_cache_path(f), settings_current,modeltype)
                result = root_detection.postprocess(result)
                segmentation_path  = get_cache_path(aftertxt+f+'.segmentation.png' )   
                backend.write_as_png(segmentation_path, result['segmentation'])
            res_current = evaluation.evaluate_files(files,aftertxt)

            print(res_startingpoint)
            print('yayayayayayayaya')
            print(modeltype)
            print(res_current)
            # ENDS HERE
            return flask.jsonify({'results_startingpoint':res_startingpoint, 'results_current':res_current})

    # Refresh Allinfo to make new saved models appear in model selection tab.
    def refresh_allinfo(self):

        # Extract stored model informations in a list
        mypath = f'{get_models_path()}/detection/information'
        onlyfiles = [os.path.join(mypath, f) for f in os.listdir(mypath) if os.path.isfile(os.path.join(mypath, f))]
        Allinfo = []
        for f in onlyfiles:
            Allinfo.append(json.load(open(f,'r')))

        return flask.jsonify({'Allinfo':Allinfo})

    def discard_model(self):
        # Retrieve what model type to discard
        modeltype = flask.request.args.get('options[training_type]', 'detection')
        # Retrieve and apply default settings for active models for this modeltype
        defaults = backend.settings.Settings.get_defaults()
        settings = self.get_settings()
        # Current user settings
        s = session['settings']
        s = s['settings']
        # Update settings active models and load model into settings
        s['active_models'][modeltype] = defaults['active_models'][modeltype]
        settings.set_settings(s)
        update_user_settings(settings)
        return 'OK'
